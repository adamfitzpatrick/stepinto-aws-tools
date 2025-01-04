import { unmarshall, marshall } from "@aws-sdk/util-dynamodb";
import {
  AttributeValue,
  DynamoDBClient,
  BatchWriteItemCommand,
  GetItemCommand,
  PutItemCommand,
  QueryCommand,
  QueryCommandInput
} from "@aws-sdk/client-dynamodb";

export interface dtoMapper<T extends DynamoItem, U> {
  (dbObject: T): U
}

export interface DynamoItem {
  pk: string;
  sk: string;
}

export interface DynamoItemNamespace {
  pkPrefix: string,
  skPrefix: string
}

export class DynamoItemDao<T extends DynamoItem> {
  static readonly delimiter = '#';

  client: DynamoDBClient;
  tableName: string;
  pkPrefix: string;
  skPrefix: string;

  constructor(tableName: string, namespace: DynamoItemNamespace) {
    this.client = new DynamoDBClient();
    this.tableName = tableName;
    this.pkPrefix = namespace.pkPrefix;
    this.skPrefix = namespace.skPrefix;
  }

  async get(pk: string, sk: string): Promise<T | null> {
    this.#checkNamespace(pk, sk);

    const command = new GetItemCommand({
      TableName: this.tableName,
      Key: {
        pk: {
          'S': pk
        },
        sk: {
          'S': sk
        }
      }
    });
    const response = await this.client.send(command);
    return response.Item ? unmarshall(response.Item) as T : null;
  }

  async getAll(pk: string): Promise<T[]> {
    this.#checkNamespace(pk);

    return this.#iterativeQuery(pk);
  }

  async put(payload: T): Promise<void>;
  async put(payload: T[]): Promise<void>;
  async put(payload: unknown): Promise<void> {
    if (Array.isArray(payload)) {
      return this.#batchPut(payload);
    } 

    const item = payload as T;
    this.#checkNamespace(item.pk, item.sk);

    const command = new PutItemCommand({
      TableName: this.tableName,
      Item: marshall(item)
    });
    await this.client.send(command);
  }

  async #iterativeQuery(pk: string, itemsSoFar: T[] = [], lastEvaluatedKey?: Record<string, AttributeValue>): Promise<T[]> {
    const commandInput: QueryCommandInput = {
      TableName: this.tableName,
      ExpressionAttributeValues: {
        ':pk': {
          S: pk
        },
        ':sk': {
          S: `${this.skPrefix}${DynamoItemDao.delimiter}`
        }
      },
      KeyConditionExpression: 'pk = :pk AND begins_with(sk, :sk)'
    };
    if (lastEvaluatedKey) {
      commandInput.ExclusiveStartKey = lastEvaluatedKey
    }
    const command = new QueryCommand(commandInput);

    const response = await this.client.send(command);
    const items = itemsSoFar.concat(response.Items ? response.Items.map(item => unmarshall(item) as T) : []);
    if (response.LastEvaluatedKey) {
      return this.#iterativeQuery(pk, items, response.LastEvaluatedKey);
    }
    return items;
  }

  async #batchPut(items: DynamoItem[]): Promise<void> {
    items.forEach(item => this.#checkNamespace(item.pk, item.sk));

    const groupedItems: DynamoItem[][] = [];
    let groupCount = Math.floor(items.length / 25);
    if (items.length % 25 !== 0) {
      groupCount++;
    }
    for (let k = 0; k < groupCount; k++) {
      const startIndex = k * 25
      groupedItems.push(items.slice(startIndex, startIndex + 25));
    }

    await Promise.all(groupedItems.map(group => this.#batchPutGroup(group)));
  }

  async #batchPutGroup(items: DynamoItem[]): Promise<void> {
    const tableRequestItems = items.map(item => {
      return {
        PutRequest: {
          Item: marshall(item)
        }
      }
    });
    const command = new BatchWriteItemCommand({
      RequestItems: {
        [this.tableName]: tableRequestItems
      }
    });
    await this.client.send(command);
  }

  #checkNamespace(pk: string, sk?: string) {
    const receivedPkPrefix = pk.slice(0, pk.indexOf(DynamoItemDao.delimiter));
    const receivedSkPrefix = sk && sk.slice(0, sk.indexOf(DynamoItemDao.delimiter));
    if (receivedPkPrefix != this.pkPrefix) {
      throw new Error('Invalid pk prefix for client');
    }
    if (receivedSkPrefix && receivedSkPrefix != this.skPrefix) {
      throw new Error('Invalid sk prefix for client');
    }
  }
}
