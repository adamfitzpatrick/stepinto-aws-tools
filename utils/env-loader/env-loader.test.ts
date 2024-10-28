import { loadEnv, EnvironmentVariableName } from '.';

describe('loadEnv utility function', () => {

  beforeEach(() => {
    process.env[EnvironmentVariableName.ACCOUNT] = 'account';
    process.env[EnvironmentVariableName.REGION] = 'region';
    process.env[EnvironmentVariableName.PREFIX] = 'tst';
    process.env['DOMAIN'] = 'domain';
    process.env['DATA_TABLE_NAME'] = 'table';
  });


  test('should load all require environment variable for a given lambda', () => {
    expect(loadEnv([
      'DOMAIN',
    ])).toEqual({
      [EnvironmentVariableName.ACCOUNT]: 'account',
      [EnvironmentVariableName.REGION]: 'region',
      [EnvironmentVariableName.PREFIX]: 'tst',
      'DOMAIN': 'domain'
    });
    expect(loadEnv([
      'DOMAIN',
      'DATA_TABLE_NAME'
    ])).toEqual({
      [EnvironmentVariableName.ACCOUNT]: 'account',
      [EnvironmentVariableName.REGION]: 'region',
      [EnvironmentVariableName.PREFIX]: 'tst',
      'DOMAIN': 'domain',
      'DATA_TABLE_NAME': 'table'
    });
  });

  test('should load standard environment vars if none are specified', () => {
    expect(loadEnv()).toEqual({
      [EnvironmentVariableName.ACCOUNT]: 'account',
      [EnvironmentVariableName.REGION]: 'region',
      [EnvironmentVariableName.PREFIX]: 'tst'
    })
  });

  test('should throw an error if any required environment variable is not available', () => {
    delete process.env['DATA_TABLE_NAME'];
    expect(() => loadEnv(['DATA_TABLE_NAME'])).toThrow();
    delete process.env[EnvironmentVariableName.ACCOUNT];
    expect(() => loadEnv()).toThrow();
  });
});
