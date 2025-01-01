import { NextRequest, NextResponse } from 'next/server';
import { ToolsetManager } from '@/utils/composio/toolsetmanager';
import { isExistingConnectedAccount } from '@/utils/composio/entitymanagement';
import { logger } from '@/utils/logger';

type ConnectResponse = {
  isExistingAccount: boolean;
  success: boolean;
  data: string;
  lastSync: string;
}

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ entityId: string }> },
): Promise<NextResponse<ConnectResponse>> {
  try {
    const entityId = (await params).entityId;
    logger.info('Processing connection request', { entityId });

    const userMetadata = JSON.parse(req.headers.get('x-user-metadata') || '{}');
    const lastSync = userMetadata.last_synced || "";
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
          integrationId: "bd230eac-3320-4af4-8244-3bda43ad06cd"
        });

        const connectionRequest = await toolset.client.connectedAccounts.initiate({
            entityId: entityId,
            integrationId: "bd230eac-3320-4af4-8244-3bda43ad06cd",
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
              lastSync: lastSync
            });
        } else if (connectionRequest.connectionStatus === "ACTIVE") {
            return NextResponse.json<ConnectResponse>({ 
              isExistingAccount: false, 
              success: true, 
              data: "",
              lastSync: lastSync
            });
        } else {
            return NextResponse.json<ConnectResponse>({ 
              isExistingAccount: false, 
              success: false, 
              data: connectionRequest.redirectUrl ?? "",
              lastSync: lastSync
            });
        }
    } else {
        logger.info('Using existing connection', { entityId });
        return NextResponse.json<ConnectResponse>({ 
          isExistingAccount: true, 
          success: true, 
          data: "",
          lastSync: lastSync
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
      lastSync: ""
    }, { status: 500 });
  }
}