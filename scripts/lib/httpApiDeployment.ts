import {
  CreateApiCommand,
  CreateIntegrationCommand,
  CreateRouteCommand,
  CreateStageCommand,
  GetApisCommand,
  GetIntegrationsCommand,
  GetRoutesCommand,
  GetStagesCommand,
  type Api,
  type ApiGatewayV2Client,
} from "@aws-sdk/client-apigatewayv2";

export interface HttpRouteDeployment {
  readonly apiName: string;
  readonly routeKey: string;
  readonly functionArn: string;
}

export interface DeployedHttpApi {
  readonly apiId: string;
  readonly apiEndpoint: string;
}

export const DEFAULT_STAGE = "$default";

const PAYLOAD_FORMAT_VERSION = "2.0";

type ApiDescription = Partial<Pick<Api, "ApiId" | "ApiEndpoint" | "Name">>;

function toDeployedApi(api: ApiDescription): DeployedHttpApi {
  if (api.ApiId === undefined || api.ApiEndpoint === undefined) {
    throw new Error(`API ${api.Name ?? "unknown"} has no identifier or endpoint`);
  }
  return { apiId: api.ApiId, apiEndpoint: api.ApiEndpoint };
}

export async function findHttpApi(
  client: ApiGatewayV2Client,
  apiName: string,
): Promise<DeployedHttpApi | undefined> {
  let nextToken: string | undefined;
  do {
    const response = await client.send(new GetApisCommand({ NextToken: nextToken }));
    const api = response.Items?.find((candidate) => candidate.Name === apiName);
    if (api !== undefined) {
      return toDeployedApi(api);
    }
    nextToken = response.NextToken;
  } while (nextToken !== undefined);
  return undefined;
}

async function ensureApi(client: ApiGatewayV2Client, apiName: string): Promise<DeployedHttpApi> {
  const existing = await findHttpApi(client, apiName);
  if (existing !== undefined) {
    return existing;
  }
  return toDeployedApi(
    await client.send(new CreateApiCommand({ Name: apiName, ProtocolType: "HTTP" })),
  );
}

async function ensureIntegration(
  client: ApiGatewayV2Client,
  apiId: string,
  functionArn: string,
): Promise<string> {
  const integrations = await client.send(new GetIntegrationsCommand({ ApiId: apiId }));
  const existing = integrations.Items?.find(
    (integration) => integration.IntegrationUri === functionArn,
  );
  const integrationId =
    existing?.IntegrationId ??
    (
      await client.send(
        new CreateIntegrationCommand({
          ApiId: apiId,
          IntegrationType: "AWS_PROXY",
          IntegrationUri: functionArn,
          PayloadFormatVersion: PAYLOAD_FORMAT_VERSION,
        }),
      )
    ).IntegrationId;
  if (integrationId === undefined) {
    throw new Error(`Integration for ${functionArn} has no identifier`);
  }
  return integrationId;
}

async function ensureRoute(
  client: ApiGatewayV2Client,
  apiId: string,
  routeKey: string,
  integrationId: string,
): Promise<void> {
  const routes = await client.send(new GetRoutesCommand({ ApiId: apiId }));
  if (routes.Items?.some((route) => route.RouteKey === routeKey) === true) {
    return;
  }
  await client.send(
    new CreateRouteCommand({
      ApiId: apiId,
      RouteKey: routeKey,
      Target: `integrations/${integrationId}`,
    }),
  );
}

async function ensureDefaultStage(client: ApiGatewayV2Client, apiId: string): Promise<void> {
  const stages = await client.send(new GetStagesCommand({ ApiId: apiId }));
  if (stages.Items?.some((stage) => stage.StageName === DEFAULT_STAGE) === true) {
    return;
  }
  await client.send(
    new CreateStageCommand({ ApiId: apiId, StageName: DEFAULT_STAGE, AutoDeploy: true }),
  );
}

export async function deployHttpRoute(
  client: ApiGatewayV2Client,
  deployment: HttpRouteDeployment,
): Promise<DeployedHttpApi> {
  const api = await ensureApi(client, deployment.apiName);
  const integrationId = await ensureIntegration(client, api.apiId, deployment.functionArn);
  await ensureRoute(client, api.apiId, deployment.routeKey, integrationId);
  await ensureDefaultStage(client, api.apiId);
  return api;
}
