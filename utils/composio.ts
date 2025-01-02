import { logger } from "./logger";

export function getEntityIdFromEmail(email: string) {
    const entityId = email.split('@')[0];
    logger.debug('Making connection request', {
        entityId
    });
    return entityId;
}
