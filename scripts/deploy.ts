import { readFile } from "node:fs/promises";
import { ApiGatewayV2Client } from "@aws-sdk/client-apigatewayv2";
import { LambdaClient } from "@aws-sdk/client-lambda";
import { zipSync } from "fflate";
import { ConfigurationError, loadConfig, type AppConfig } from "../src/config/env";
import {
  API_NAME,
  BUNDLE_ENTRY_NAME,
  ENDPOINTS,
  invokeUrl,
  lambdaEnvironment,
  routeKey,
  routeSourceArn,
  type EndpointDeployment,
} from "./lib/deploymentSettings";
import { deployHttpRoute } from "./lib/httpApiDeployment";
import { allowApiGatewayInvoke, deployFunction } from "./lib/lambdaDeployment";

interface DeploymentContext {
  readonly config: AppConfig;
  readonly roleArn: string;
  readonly lambdaClient: LambdaClient;
  readonly apiClient: ApiGatewayV2Client;
}

function clientOptions(config: AppConfig): { region: string; endpoint?: string } {
  return {
    region: config.awsRegion,
    ...(config.awsEndpoint === undefined ? {} : { endpoint: config.awsEndpoint }),
  };
}

function requireRoleArn(): string {
  const roleArn = process.env.LAMBDA_ROLE_ARN?.trim();
  if (roleArn === undefined || roleArn === "") {
    throw new ConfigurationError("Missing required environment variable LAMBDA_ROLE_ARN");
  }
  return roleArn;
}

async function deployEndpoint(
  context: DeploymentContext,
  endpoint: EndpointDeployment,
): Promise<void> {
  const bundle = await readFile(endpoint.bundlePath);
  const functionArn = await deployFunction(context.lambdaClient, {
    functionName: endpoint.functionName,
    roleArn: context.roleArn,
    zipFile: zipSync({ [BUNDLE_ENTRY_NAME]: bundle }),
    environment: lambdaEnvironment(context.config),
  });
  console.log(`Deployed function ${functionArn}`);

  const api = await deployHttpRoute(context.apiClient, {
    apiName: API_NAME,
    routeKey: routeKey(endpoint),
    functionArn,
  });
  await allowApiGatewayInvoke(
    context.lambdaClient,
    endpoint.functionName,
    routeSourceArn(functionArn, api.apiId, endpoint),
  );
  console.log(`${routeKey(endpoint)}: ${invokeUrl(context.config, api, endpoint)}`);
}

async function main(): Promise<void> {
  const config = loadConfig();
  const context: DeploymentContext = {
    config,
    roleArn: requireRoleArn(),
    lambdaClient: new LambdaClient(clientOptions(config)),
    apiClient: new ApiGatewayV2Client(clientOptions(config)),
  };
  for (const endpoint of ENDPOINTS) {
    await deployEndpoint(context, endpoint);
  }
}

await main();
