import { unmarshall, marshall } from "@aws-sdk/util-dynamodb";
import {
  AttributeValue,
  DynamoDBClient,
  BatchWriteItemCommand,
  GetItemCommand,
  PutItemCommand,
  QueryCommand,
  QueryCommandInput,
  DeleteItemCommand
} from "@aws-sdk/client-dynamodb";

const PREFIX_DELIMITER = '#';

export interface DynamoItem {
  pk: string;
  sk: string;
}
export interface MapperNamespace {
  pkPrefix: string;
  skPrefix: string;
  pkFieldName: string;
  skFieldName: string;
}

export class ObjectMapper<T extends DynamoItem, U> {
  #_pkPrefix: string;
  #_skPrefix: string;
  #pkFieldName: string;
  #skFieldName: string;

  constructor(mapperNamespace: MapperNamespace) {
    this.#_pkPrefix = mapperNamespace.pkPrefix;
    this.#_skPrefix = mapperNamespace.skPrefix;
    this.#pkFieldName = mapperNamespace.pkFieldName;
    this.#skFieldName = mapperNamespace.skFieldName;
  }

  get pkPrefix() {
    return this.#_pkPrefix;
  }

  get skPrefix() {
    return this.#_skPrefix;
  }

  getNamespacedKeys(rawPk: string, rawSk?: string) {
    return {
      pk: `${this.#_pkPrefix}${PREFIX_DELIMITER}${rawPk}`,
      sk: rawSk ? `${this.#_skPrefix}${PREFIX_DELIMITER}${rawSk}` : null
    }
  }
  
  toDTO(item: T) {
    const dto: any = { ...item };
    delete dto.pk;
    delete dto.sk;
    return dto as U;
  }

  fromDTO(dto: U) {
    const obj = dto as Record<string, string>;
    const { pk, sk } = this.getNamespacedKeys(obj[this.#pkFieldName], obj[this.#skFieldName]);
    return { pk, sk, ...obj } as T
  }
}

export class DynamoItemDao<T extends DynamoItem, U> {
  client: DynamoDBClient;
  tableName: string;
  mapper: ObjectMapper<T, U>;

  constructor(tableName: string, mapper: ObjectMapper<T, U>) {
    this.client = new DynamoDBClient();
    this.tableName = tableName;
    this.mapper = mapper;
  }

  async get(rawPk: string, rawSk: string): Promise<U | null> {
    const { pk, sk } = this.mapper.getNamespacedKeys(rawPk, rawSk);
    const command = new GetItemCommand({
      TableName: this.tableName,
      Key: {
        pk: {
          'S': pk
        },
        sk: {
          'S': sk!
        }
      }
    });
    console.debug('DynamoDB command', JSON.stringify(command));
    const response = await this.client.send(command);
    return response.Item ? this.mapper.toDTO(unmarshall(response.Item) as T) : null;
  }

  async getAll(pk: string): Promise<U[]> {
    return this.#iterativeQuery(pk);
  }

  async put(payload: U): Promise<void>;
  async put(payload: U[]): Promise<void>;
  async put(payload: unknown): Promise<void> {
    if (Array.isArray(payload)) {
      return this.#batchPut(payload as U[]);
    } 

    const item = this.mapper.fromDTO(payload as U);

    const command = new PutItemCommand({
      TableName: this.tableName,
      Item: marshall(item)
    });
    console.debug('DynamoDB command', JSON.stringify(command));
    await this.client.send(command);
  }

  async delete(rawPk: string, rawSk: string) {
    const { pk, sk } = this.mapper.getNamespacedKeys(rawPk, rawSk);
    const command = new DeleteItemCommand({
      TableName: this.tableName,
      Key: {
        pk: {
          S: pk
        },
        sk: {
          S: sk!
        }
      }
    });
    await this.client.send(command);
  }

  async #iterativeQuery(rawPk: string, itemsSoFar: U[] = [], lastEvaluatedKey?: Record<string, AttributeValue>): Promise<U[]> {
    const { pk } = this.mapper.getNamespacedKeys(rawPk);
    const commandInput: QueryCommandInput = {
      TableName: this.tableName,
      ExpressionAttributeValues: {
        ':pk': {
          S: pk
        },
        ':sk': {
          S: `${this.mapper.skPrefix}${PREFIX_DELIMITER}`
        }
      },
      KeyConditionExpression: 'pk = :pk AND begins_with(sk, :sk)'
    };
    if (lastEvaluatedKey) {
      commandInput.ExclusiveStartKey = lastEvaluatedKey
    }
    const command = new QueryCommand(commandInput);
    console.debug('DynamoDB command', JSON.stringify(command));

    const response = await this.client.send(command);
    const items = itemsSoFar.concat(response.Items ? response.Items.map(item => this.mapper.toDTO(unmarshall(item) as T)) : []);
    if (response.LastEvaluatedKey) {
      return this.#iterativeQuery(rawPk, items, response.LastEvaluatedKey);
    }
    return items;
  }

  async #batchPut(items: U[]): Promise<void> {
    const groupedItems: T[][] = [];
    let groupCount = Math.floor(items.length / 25);
    if (items.length % 25 !== 0) {
      groupCount++;
    }
    for (let k = 0; k < groupCount; k++) {
      const startIndex = k * 25

      groupedItems.push(items.slice(startIndex, startIndex + 25).map(item => this.mapper.fromDTO(item)));
    }

    await Promise.all(groupedItems.map(group => this.#batchPutGroup(group)));
  }

  async #batchPutGroup(items: T[]): Promise<void> {
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
    console.debug('DynamoDB command', JSON.stringify(command));
    await this.client.send(command);
  }
}
