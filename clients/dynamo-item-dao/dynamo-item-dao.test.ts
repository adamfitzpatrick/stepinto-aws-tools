import { DynamoItemDao, DynamoItem, ObjectMapper } from ".";
import { AttributeValue } from "@aws-sdk/client-dynamodb";

const sendSpy = jest.fn();
const getItemCommandSpy = jest.fn();
const queryCommandSpy = jest.fn();
const putItemCommandSpy = jest.fn();
const deleteItemCommandSpy = jest.fn();
const batchWriteItemCommandSpy = jest.fn();

jest.mock('@aws-sdk/client-dynamodb', function () {
  return {
    GetItemCommand: function (input: any) { return getItemCommandSpy(input); },
    QueryCommand: function (input: any) { return queryCommandSpy(input); },
    PutItemCommand: function (input: any) { return putItemCommandSpy(input); },
    DeleteItemCommand: function (input: any) { return deleteItemCommandSpy(input); },
    BatchWriteItemCommand: function (input: any) { return batchWriteItemCommandSpy(input); },
    DynamoDBClient: function () {
      return {
        send: async (...args: any[]) => sendSpy(...args)
      };
    }
  }
});

interface TestDTO {
  a: string;
  b: string;
}

describe('dynamo-item-dao', () => {
  let unmarshalledFirstItem: TestDTO;
  let unmarshalledSecondItem: TestDTO;
  let marshalledFirstItem: Record<string, AttributeValue>;
  let marshalledSecondItem: Record<string, AttributeValue>;
  let sut: DynamoItemDao<DynamoItem, TestDTO>;

  beforeEach(() => {
    unmarshalledFirstItem = {
      a: 'id',
      b: 'value'
    };
    marshalledFirstItem = {
      pk: { S: 'primary#id' },
      sk: { S: 'sort#value' },
      a: { S: 'id' },
      b: { S: 'value' }
    };
    unmarshalledSecondItem = {
      a: 'id',
      b: 'value2'
    };
    marshalledSecondItem = {
      pk: { S: 'primary#id' },
      sk: { S: 'sort#value2' },
      a: { S: 'id' },
      b: { S: 'value2' }
    };
    const mapper = new ObjectMapper<DynamoItem, TestDTO>({
      pkPrefix: 'primary',
      skPrefix: 'sort',
      pkFieldName: 'a',
      skFieldName: 'b'
    });
    sut = new DynamoItemDao<DynamoItem, TestDTO>( 'Table', mapper);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('get', () => {
    test('should return the single item requested', async () => {
      sendSpy.mockResolvedValue({
        Item: marshalledFirstItem
      });

      const item = await sut.get('id', 'value');

      expect(item).toEqual(unmarshalledFirstItem);
      expect(getItemCommandSpy).toHaveBeenCalledWith({
        TableName: 'Table',
        Key: {
          pk: { S: 'primary#id' },
          sk: { S: 'sort#value' }
        }
      });
    });

    test('should return null if the item cannot be found', async () => {
      sendSpy.mockResolvedValue({});

      await expect(sut.get('id', 'value')).resolves.toBeNull();
      expect(getItemCommandSpy).toHaveBeenCalledWith({
        TableName: 'Table',
        Key: {
          pk: { S: 'primary#id' },
          sk: { S: 'sort#value' }
        }
      });
    });

    test('should reject if there was an error calling DynamoDB', async () => {
      sendSpy.mockRejectedValue('error');
      await expect(sut.get('primary#id', 'sort#value')).rejects.toBe('error');
    });
  });

  describe('getAll', () => {
    test('should return all items matching the primary key and sort key prefix', async () => {
      sendSpy.mockResolvedValue({
        Items: [marshalledFirstItem]
      });

      await expect(sut.getAll('id')).resolves.toEqual([unmarshalledFirstItem]);
      expect(queryCommandSpy).toHaveBeenCalledWith({
        TableName: 'Table',
        ExpressionAttributeValues: {
          ':pk': { S: 'primary#id' },
          ':sk': { S: 'sort#' }
        },
        KeyConditionExpression: 'pk = :pk AND begins_with(sk, :sk)'
      })
    });

    test('should return an empty array if the items cannot be found', async () => {
      sendSpy.mockResolvedValue({
        Items: []
      });
      
      await expect(sut.getAll('id')).resolves.toEqual([]);

      expect(queryCommandSpy).toHaveBeenCalledTimes(1);
      expect(sendSpy).toHaveBeenCalledTimes(1);
      expect(queryCommandSpy).toHaveBeenCalledWith({
        TableName: 'Table',
        ExpressionAttributeValues: {
          ':pk': { S: 'primary#id' },
          ':sk': { S: 'sort#' }
        },
        KeyConditionExpression: 'pk = :pk AND begins_with(sk, :sk)'
      })
    });

    test('should make multiple DynamoDB calls to obtain all data', async () => {
      sendSpy.mockResolvedValueOnce({
        Items: [marshalledFirstItem],
        LastEvaluatedKey: {
          pk: { S: 'primary#id' },
          sk: { S: 'sort#value'}
        }
      });
      sendSpy.mockResolvedValue({
        Items: [marshalledSecondItem]
      });

      await expect(sut.getAll('id')).resolves.toEqual([ unmarshalledFirstItem, unmarshalledSecondItem ]);

      expect(queryCommandSpy).toHaveBeenCalledTimes(2);
      expect(sendSpy).toHaveBeenCalledTimes(2);
      expect(queryCommandSpy).toHaveBeenNthCalledWith(1, {
        TableName: 'Table',
        ExpressionAttributeValues: {
          ':pk': { S: 'primary#id' },
          ':sk': { S: 'sort#' }
        },
        KeyConditionExpression: 'pk = :pk AND begins_with(sk, :sk)'
      });
      expect(queryCommandSpy).toHaveBeenNthCalledWith(2, {
        TableName: 'Table',
        ExpressionAttributeValues: {
          ':pk': { S: 'primary#id' },
          ':sk': { S: 'sort#' }
        },
        KeyConditionExpression: 'pk = :pk AND begins_with(sk, :sk)',
        ExclusiveStartKey: {
          pk: { S: 'primary#id' },
          sk: { S: 'sort#value' }
        }
      });
    });

    test('should reject if there was an error calling DynamoDB', async () => {
      sendSpy.mockRejectedValue('error');
      await expect(sut.getAll('id')).rejects.toBe('error');
    });
  });

  describe('put', () => {
    test('should save a single item to DynamoDB', async () => {
      sendSpy.mockResolvedValue({});

      await sut.put(unmarshalledFirstItem);

      expect(putItemCommandSpy).toHaveBeenCalledTimes(1);
      expect(batchWriteItemCommandSpy).not.toHaveBeenCalled();
      expect(sendSpy).toHaveBeenCalledTimes(1);
      expect(putItemCommandSpy).toHaveBeenCalledWith({
        TableName: 'Table',
        Item: marshalledFirstItem
      });
    });

    test('should save multiple items to DynamoDB', async () => {
      sendSpy.mockResolvedValue({});

      await sut.put([unmarshalledFirstItem, unmarshalledSecondItem]);

      expect(putItemCommandSpy).not.toHaveBeenCalled();
      expect(batchWriteItemCommandSpy).toHaveBeenCalledTimes(1);
      expect(sendSpy).toHaveBeenCalledTimes(1);
      expect(batchWriteItemCommandSpy).toHaveBeenCalledWith({
        RequestItems: {
          'Table': [
            {
              PutRequest: {
                Item: marshalledFirstItem
              }
            },
            {
              PutRequest: {
                Item: marshalledSecondItem
              }
            }
          ]
        }
      });
    });

    test('should make multiple calls when there are more than 25 items', async () => {
      const additionalUnmarshalledItems: TestDTO[] = [];
      const additionalMarshalledItems: Record<string, AttributeValue>[] = [];
      for (let k = 0; k < 25; k++) {
        additionalUnmarshalledItems.push({
          a: 'id2',
          b: `value${k+3}`
        });
        additionalMarshalledItems.push({
          pk: { S: 'primary#id2' },
          sk: { S: `sort#value${k+3}` },
          a: { S: 'id2' },
          b: { S: `value${k+3}` }
        });
      }
      const allMarshalledItems = [ marshalledFirstItem, marshalledSecondItem, ...additionalMarshalledItems ];

      await sut.put([ unmarshalledFirstItem, unmarshalledSecondItem, ...additionalUnmarshalledItems ]);

      expect(putItemCommandSpy).not.toHaveBeenCalled();
      expect(batchWriteItemCommandSpy).toHaveBeenCalledTimes(2);
      expect(sendSpy).toHaveBeenCalledTimes(2);
      expect(batchWriteItemCommandSpy).toHaveBeenNthCalledWith(1, {
        RequestItems: {
          'Table': allMarshalledItems.slice(0, 25).map(item => {
            return {
              PutRequest: { Item: item }
            }
          })
        }
      });
      expect(batchWriteItemCommandSpy).toHaveBeenNthCalledWith(2, {
        RequestItems: {
          'Table': allMarshalledItems.slice(25).map(item => {
            return {
              PutRequest: { Item: item }
            }
          })
        }
      });
    });

    test('should reject if there was an error calling DynamoDB', async () => {
      sendSpy.mockRejectedValue('error');

      await expect(sut.put(unmarshalledFirstItem)).rejects.toBe('error');

      expect(putItemCommandSpy).toHaveBeenCalledTimes(1);
      expect(sendSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('delete', () => {
    test('should remove a single item from DynamoDB', async () => {
      sendSpy.mockResolvedValue({});

      await sut.delete('id', 'value');

      expect(deleteItemCommandSpy).toHaveBeenCalledWith({
        TableName: 'Table',
        Key: {
          pk: { S: 'primary#id' },
          sk: { S: 'sort#value' }
        }
      });
      expect(sendSpy).toHaveBeenCalled();
    });

    test('should reject if there was an error calling DynamoDB', async () => {
      sendSpy.mockRejectedValue('error');

      await expect(sut.delete('id', 'value')).rejects.toBe('error');

      expect(deleteItemCommandSpy).toHaveBeenCalledTimes(1);
      expect(sendSpy).toHaveBeenCalledTimes(1);
    })
  })
});
