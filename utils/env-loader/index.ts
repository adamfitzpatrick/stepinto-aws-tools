import { config } from 'dotenv';
import { resolve } from 'path';

const ENV_PATH = resolve(__dirname, '../../../../');
config({
  path: [
    resolve(ENV_PATH, '.env.local'),
    resolve(ENV_PATH, '.env')
  ]
});

export enum EnvironmentVariableName {
  ACCOUNT = 'STEPINTO_APP_TARGET_ACCOUNT_ID',
  REGION  = 'STEPINTO_APP_TARGET_REGION',
  PREFIX  = 'STEPINTO_APP_TARGET_ENV_PREFIX'
}

const standardEnvironmentVars: string[] = [
  EnvironmentVariableName.ACCOUNT,
  EnvironmentVariableName.REGION,
  EnvironmentVariableName.PREFIX
]

interface EnvironmentMap {
  [key: string]: string
}

export function loadEnv(variableNames?: string[]) {
  let envMap: EnvironmentMap = {};
  let errors = [];
  const names = standardEnvironmentVars.concat(variableNames || []);
  
  names.forEach(envVar => {
    envMap[envVar] = process.env[envVar]!
    if (!envMap[envVar]) { errors.push(envVar) }
  });

  checkEnvironment(envMap);
  return envMap;
}

function checkEnvironment(envMap: EnvironmentMap) {
  const message = Object.keys(envMap).reduce((missing, current) => {
    if (!envMap[current]) { missing = `${current}, ${missing}` };
    return missing;
  }, '');
  if (message.length > 0) {
    throw new Error(`${message} environment value cannot be found`);
  }
}
