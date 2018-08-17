import {factory, Logger} from '@hopin/logger';

export const logger: Logger = factory.getLogger('hoping-static', {
  prefix: 'hopin-static',
});