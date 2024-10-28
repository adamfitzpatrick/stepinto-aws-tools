import { StackProps, Environment as CdkEnvironment } from "aws-cdk-lib";

export type Environment = Required<CdkEnvironment> & {
  prefix: string;
}

export interface StepintoBaseProps extends StackProps {
  env: Environment;
  appName: string;
}

export interface StepintoBaseConstructProps extends StepintoBaseProps {
  constructName: string;
}
