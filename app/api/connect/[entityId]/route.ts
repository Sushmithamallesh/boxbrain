import { NextRequest, NextResponse } from 'next/server';
import { ToolsetManager } from '@/utils/composio/toolsetmanager-singleton';
import { isExistingConnectedAccount } from '@/utils/composio/entitymanagement';
import { logger } from '@/utils/logger';

const COMPOSIO_INTEGRATION_ID = "bd230eac-3320-4af4-8244-3bda43ad06cd";
type ConnectResponse = {
  isExistingAccount: boolean;
  success: boolean;
  data: string; 
}

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ entityId: string }> },
): Promise<NextResponse<ConnectResponse>> {
  try {
    const entityId = (await params).entityId;
    logger.info('Processing connection request', { entityId });

    const userMetadata = JSON.parse(req.headers.get('x-user-metadata') || '{}');
    logger.debug('User metadata received', { userMetadata });
    
    const toolset = ToolsetManager.getToolset();
    const isExistingAccount = await isExistingConnectedAccount(entityId);
    logger.info('Account status checked', { 
      entityId, 
      isExistingAccount 
    });

    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : 'http://localhost:3000';

    logger.debug('Using base URL', { baseUrl });

    if (!isExistingAccount) {
        const redirectUrl = `${baseUrl}/boxes/home`;
        logger.info('Initiating new connection request', { 
          entityId, 
          redirectUrl,
          integrationId:COMPOSIO_INTEGRATION_ID
        });

        const connectionRequest = await toolset.client.connectedAccounts.initiate({
            entityId: entityId,
            integrationId: COMPOSIO_INTEGRATION_ID,
            redirectUri: redirectUrl,
            authMode: "OAUTH2",
            authConfig: {},
        });
        
        logger.info('Connection request completed', {
          entityId,
          status: connectionRequest.connectionStatus
        });

        if (connectionRequest.connectionStatus === "INITIATED") {
            return NextResponse.json<ConnectResponse>({ 
              isExistingAccount: false, 
              success: true, 
              data: connectionRequest.redirectUrl ?? "",
            });
        } else if (connectionRequest.connectionStatus === "ACTIVE") {
            return NextResponse.json<ConnectResponse>({ 
              isExistingAccount: false, 
              success: true, 
              data: "",
            });
        } else {
            return NextResponse.json<ConnectResponse>({ 
              isExistingAccount: false, 
              success: false, 
              data: connectionRequest.redirectUrl ?? "",
            });
        }
    } else {
        logger.info('Using existing connection', { entityId });
        return NextResponse.json<ConnectResponse>({ 
          isExistingAccount: true, 
          success: true, 
          data: "",
        });
    }
  } catch (error) {
    logger.error('Connection request failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    return NextResponse.json<ConnectResponse>({
      isExistingAccount: false,
      success: false,
      data: "",
    }, { status: 500 });
  }
}