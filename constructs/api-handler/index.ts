import { Construct } from "constructs";
import { Effect, PolicyDocument, PolicyStatement, Role, ServicePrincipal } from "aws-cdk-lib/aws-iam";
import { ApplicationLogLevel, Code, Function as LambdaFunction, LayerVersion, LoggingFormat, Runtime, Tracing } from 'aws-cdk-lib/aws-lambda'
import { Duration } from "aws-cdk-lib";
import { StepintoBaseConstruct, StepintoBaseConstructProps } from "..";
import { EnvironmentVariableName } from "../../utils/env-loader";

const SECRETS_LAMBDA_EXTENSION_ARN =
  'arn:aws:lambda:us-west-2:345057560386:layer:AWS-Parameters-and-Secrets-Lambda-Extension:12';

export interface ApiHandlerProps extends StepintoBaseConstructProps {
  handlerPath: string;
  handler?: string;
  dataTableName: string;
  usesSecrets?: boolean;
  layers: { [layerId: string]: string }
  additionalEnvironmentVariables?: { [key: string]: string };
  additionalHandlerPolicies?: PolicyStatement[];
}

/**
 * Provisions a Lambda function to handle requests incoming via API Gateway.
 * This construct assumes that a data table already exists for data persistence, and expects
 * that working lambda code is provided by the consuming stack.  The Lambda may include arbitrary
 * pre-defined layers, and automatically incorporates a layer required for the lambda function to
 * access secrets from SecretsManager in an efficient manner.  Note that access to any secrets
 * via the SecretsManager Lambda Extension Layer will require appropriate policies provided to
 * this construct.
 * 
 * The name of the existing data table can be provided to lambda code via the DATA_TABLE_NAME
 * environment variable.
 */
export class ApiHandler extends StepintoBaseConstruct {
  private _lambda: LambdaFunction;

  constructor(scope: Construct, id: string, props: ApiHandlerProps) {
    super(scope, id, props);

    const loggingPolicy = new PolicyDocument({
      statements: [new PolicyStatement({
        effect: Effect.ALLOW,
        actions: [
          'logs:CreateLogGroup',
          'logs:CreateLogStream',
          'logs:DescribeLogStreams',
          'logs:PutLogEvents'
        ],
        resources: ['*']
      })]
    });
    const additionalPolicies = props.additionalHandlerPolicies || [];
    const statements = [
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: [
          'dynamodb:GetItem',
          'dynamodb:PutItem',
          'dynamodb:Query',
          'dynamodb:DeleteItem'
        ],
        resources: ['*']
      }),
      ...additionalPolicies
    ];
    const workingPolicy = new PolicyDocument({
      statements
    });

    const role = new Role(this, this.generateId('exec-role'), {
      roleName: this.generateName('exec-role'),
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      inlinePolicies: {
        loggingPolicy,
        workingPolicy
      }
    });

    const layers = Object.keys(props.layers).map(key => {
      return LayerVersion.fromLayerVersionArn(this, this.generateId(key), props.layers[key]);
    });
    if (props.usesSecrets) {
      const secretsExtensionsLayer = LayerVersion.fromLayerVersionArn(
        this,
        this.generateId('secrets-layer'),
        SECRETS_LAMBDA_EXTENSION_ARN
      );
      layers.push(secretsExtensionsLayer);
    }
    
    const additionalEnvironmentVariables = props.additionalEnvironmentVariables || {};
    const environment = {
      [EnvironmentVariableName.DATA_TABLE_NAME]: this.generateEnvGenericName(props.dataTableName),
      ...additionalEnvironmentVariables
    }
    this._lambda = new LambdaFunction(this, this.generateId('function'), {
      functionName: this.generateName('handler'),
      runtime: Runtime.NODEJS_20_X,
      code: Code.fromAsset(props.handlerPath),
      handler: props.handler || 'index.handler',
      tracing: Tracing.ACTIVE,
      environment,
      layers,
      role,
      timeout: Duration.minutes(1),
      applicationLogLevelV2: ApplicationLogLevel.INFO,
      loggingFormat: LoggingFormat.JSON
    });
  }

  get lambda() {
    return this._lambda;
  }

  setLambdaPermission(principalStr: string) {
    this._lambda.addPermission(this.generateId('lambda-perm'), {
      action: 'lambda:InvokeFunction',
      principal: new ServicePrincipal(principalStr)
    });
  }
}
