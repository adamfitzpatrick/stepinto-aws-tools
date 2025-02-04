import { Template } from "aws-cdk-lib/assertions";
import { SingleHandlerApi, SingleHandlerApiProps } from ".";
import { App, Stack } from "aws-cdk-lib";
import { Construct } from "constructs";
import { ApiHandlerProps } from "../api-handler";
import { AssetCode, Code } from "aws-cdk-lib/aws-lambda";
import fs from 'fs';
import { SpecRestApi, Stage } from "aws-cdk-lib/aws-apigateway";

const apiSpec = {
  openapi: '3.0.0',
  paths: {
    '/resource': {
      get: {
        'x-amazon-apigateway-authorizer': {
          type: 'cognito_user_pools',
          identitySource: 'Authorization',
          providerArns: [ 'arn' ]
        }
      }
    }
  }
}
let handlerSpy: jest.Mock;
jest.mock('../api-handler', () => {
  return {
    ApiHandler: function (scope: Construct, id: string, props: ApiHandlerProps) {
      return handlerSpy(scope, id, props);
    }
  }
});
let compileSpy: jest.Mock;
jest.mock('handlebars', () => {
  return {
    compile: (template: string) => compileSpy(template)
  }
});
let parseSpy: jest.Mock;
jest.mock('yaml', () => {
  return {
    parse: (yamlStr: string) => parseSpy(yamlStr)
  }
});

class TestStack extends Stack {
  api: SingleHandlerApi;

  constructor(scope: Construct, id: string, props: SingleHandlerApiProps) {
    super(scope, id, props);

    this.api = new SingleHandlerApi(this, 'aSingleHandlerApi', props);
  }
}

describe('SingleHandlerApi construct', () => {
  let props: SingleHandlerApiProps;
  let stack: TestStack;
  let template: Template
  let setLambdaPermissionSpy: jest.SpyInstance;
  let readFileSpy: jest.SpyInstance;
  let evalSpy: jest.SpyInstance;

  beforeEach(() => {
    setLambdaPermissionSpy = jest.fn();
    handlerSpy = jest.fn().mockReturnValue({
      lambda: {
        functionArn: 'function'
      },
      setLambdaPermission: setLambdaPermissionSpy
    });
    evalSpy = jest.fn().mockReturnValue('')
    compileSpy = jest.fn().mockReturnValue(evalSpy);
    parseSpy = jest.fn().mockReturnValue(apiSpec);
    jest.spyOn(Code, 'fromAsset').mockReturnValue(Code.fromInline('code') as any as AssetCode);
    readFileSpy = jest.spyOn(fs, 'readFileSync').mockReturnValue('');

    props = {
      appName: 'app',
      env: {
        account: 'account',
        region: 'region',
        prefix: 'tst'
      },
      dataTableName: 'table',
      constructName: 'api',
      handlerPath: 'path',
      layers: {},
      apiSpecPath: 'path',
      userPoolArn: 'user:pool:arn',
      authArnTemplateKey: 'authArn',
      handlerTemplateKey: 'handler',
    };
    const app = new App();
    stack = new TestStack(app, 'aTestStack', props);
    readFileSpy.mockRestore();
    template = Template.fromStack(stack);
  });

  test('should create the lambda handler function', () => {
    expect(handlerSpy).toHaveBeenCalledWith(
      expect.any(Construct),
      expect.anything(),
      props
    )
  });

  test('should create a rest API', () => {
    template.hasResourceProperties('AWS::ApiGateway::RestApi', {
      Body: apiSpec
    });
    template.hasResourceProperties('AWS::ApiGateway::ApiKey', {});
    template.hasResourceProperties('AWS::ApiGateway::UsagePlan', {
      Throttle: {
        BurstLimit: 10,
        RateLimit: 1
      }
    });
    template.hasResourceProperties('AWS::ApiGateway::UsagePlanKey', {
      KeyType: 'API_KEY'
    });
    template.hasResourceProperties('AWS::ApiGateway::Deployment', {});
    template.hasResourceProperties('AWS::ApiGateway::Stage', {
      StageName: 'tst'
    });
    template.hasResourceProperties('AWS::ApiGateway::Account', {});
    template.hasResourceProperties('AWS::IAM::Role', {
      AssumeRolePolicyDocument: {
        Statement: [{
          Action: 'sts:AssumeRole',
          Effect: 'Allow',
          Principal: { Service: 'apigateway.amazonaws.com' }
        }]
      }
    });
    expect(compileSpy).toHaveBeenCalled();
    expect(evalSpy).toHaveBeenCalledWith({
      authArn: expect.anything(),
      handler: 'function',
      region: 'region'
    });
    expect(parseSpy).toHaveBeenCalled();
    expect(setLambdaPermissionSpy).toHaveBeenCalledWith('apigateway.amazonaws.com')
  });

  test('should provide a getter for the resulting API', () => {
    expect(stack.api.getApi()).toBeInstanceOf(SpecRestApi);
  });

  test('should provide a getter for the deployed stage', () => {
    expect(stack.api.getStage()).toBeInstanceOf(Stage);
  })
});
