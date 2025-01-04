import { logger } from "../logger";
import { ToolsetManager } from "./toolsetmanager-singleton";

export async function isExistingConnectedAccount(entityId: string) {
    const toolset = ToolsetManager.getToolset();
    const entity = await toolset.client.getEntity(entityId);
    if (entity.id === 'default') {
      return false;
    } else {
        try {
            const connectionDetails = await entity.getConnection({app: "gmail"});
            if (connectionDetails) {
                logger.info('Connection details found', { 
                  entityId,
                  connectionDetails
                });
                return true;
            } else {
                logger.info('No connection details found', { entityId });
                return false;
            }
        } catch {
            logger.error('Error getting connection details', { entityId });
            return false;
        }
    }
}

export function getEntityIdFromEmail(email: string) {
    const entityId = email.split('@')[0];
    logger.debug('Making connection request', {
        entityId
    });
    return entityId;
}