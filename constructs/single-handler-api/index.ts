import { Construct } from "constructs";
import { ApiHandler, ApiHandlerProps } from "../api-handler";
import * as fs from 'fs';
import { compile } from 'handlebars';
import { parse } from 'yaml';
import { AccessLogFormat, ApiDefinition, ApiKey, CognitoUserPoolsAuthorizer, Deployment, EndpointType, LogGroupLogDestination, MethodLoggingLevel, SpecRestApi, Stage, UsagePlan } from "aws-cdk-lib/aws-apigateway";
import { CfnOutput, Fn } from "aws-cdk-lib";
import { StepintoBaseConstruct } from "..";
import { LogGroup } from "aws-cdk-lib/aws-logs";

export interface SingleHandlerApiProps extends ApiHandlerProps {
  apiSpecPath: string;
  userPoolArn: string;
  handlerTemplateKey: string;
  authArnTemplateKey: string;
}

export class SingleHandlerApi extends StepintoBaseConstruct {
  constructor(scope: Construct, id: string, props: SingleHandlerApiProps) {
    super(scope, id, props);

    const apiHandler = new ApiHandler(this, this.generateId('ApiHandler'), props);

    this.createApi(props, apiHandler);
  }

  createApi(props: SingleHandlerApiProps, apiHandler: ApiHandler) {
    const specTemplate = compile(fs.readFileSync(props.apiSpecPath, { encoding: 'utf-8'}));
    const apiDefinition = parse(specTemplate({
      [props.authArnTemplateKey]: props.userPoolArn,
      [props.handlerTemplateKey]: apiHandler.lambda.functionArn,
      region: props.env.region
    }));

    const api = new SpecRestApi(this, this.generateId('rest-api'), {
      apiDefinition: ApiDefinition.fromInline(apiDefinition),
      cloudWatchRole: true,
      deploy: false,
      endpointTypes: [
        EndpointType.REGIONAL
      ]
    });
    apiHandler.setLambdaPermission('apigateway.amazonaws.com');

    const deployment = new Deployment(this, 'deployment', {
      api
    });

    const accessLogGroup = new LogGroup(this, this.generateId('access-log-group'), {});
    const stage = new Stage(this, 'stage', {
      accessLogDestination: new LogGroupLogDestination(accessLogGroup),
      accessLogFormat: AccessLogFormat.jsonWithStandardFields(),
      loggingLevel: MethodLoggingLevel.INFO,
      deployment,
      stageName: props.env.prefix,
      tracingEnabled: true
    });

    const defaultApiKey = new ApiKey(this, this.generateId('default-api-key'), {
      apiKeyName: this.generateId('default-api-key-arn'),
      description: 'Highly-rate-limited key useful for manual testing and development',
    });

    const defaultUsagePlan = new UsagePlan(this, this.generateId('default-usage-plan'), {
      name: 'default-usage-plan',
      throttle: {
        burstLimit: 10,
        rateLimit: 1
      }
    });
    defaultUsagePlan.addApiKey(defaultApiKey);
    defaultUsagePlan.addApiStage({stage});
  }
}
