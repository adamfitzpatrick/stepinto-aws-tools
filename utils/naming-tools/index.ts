import { Environment } from "aws-cdk-lib";

export type NameGenerator = (unique: string) => string;

export interface AccountEnvironment extends Required<Environment> {
  prefix: string;
}

function toPascalCase(maybeSnakeCase: string) {
  return maybeSnakeCase.split('-')
    .map(part => part[0].toUpperCase() + part.slice(1))
    .join('');
}

export function generateNameGenerator(appName: string, env: AccountEnvironment) {
  const name = appName ? `${appName}-` : '';
  return function generateNameGenerator(unique: string) {
    return `${env.prefix}-${name}${unique}`;
  }
}

export function generateIdGenerator(appName: string, env: AccountEnvironment) {
  const pascalAppName = toPascalCase(appName);
  return (unique: string) => {
    const formattedUnique = toPascalCase(unique);
    return `${env.prefix}${pascalAppName}${formattedUnique}`
  }
}
