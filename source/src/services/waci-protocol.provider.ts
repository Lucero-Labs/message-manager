import { Provider } from '@nestjs/common';
import { WACIProtocol } from '@extrimian/agent';
import { CONFIG } from '../config';
import { WaciIssueCredentialDataMongoService } from './waci-issue-credential-data-mongo.service';
import { WaciPresentationMongoService } from './waci-presentation-mongo.service';
import { Logger } from '../utils/logger';
import { CredentialBuilderService } from './credential-builder.service';
import { OutgoingWebhookService } from './outgoing-webhook.service';
import { INJECTION_TOKENS } from '../constants/injection-tokens';

export const WACIProtocolProvider: Provider = {
  provide: WACIProtocol,
  useFactory: (
    config: any,
    waciIssueCredentialDataService: WaciIssueCredentialDataMongoService,
    waciPresentationDataService: WaciPresentationMongoService,
    credentialBuilder: CredentialBuilderService,
    outgoingWebhookService: OutgoingWebhookService,
    waciProtocolStorage: any, // TODO:  Use type
  ) => {
    return new WACIProtocol({
      storage: waciProtocolStorage,
      issuer: {
        issueCredentials: async (
          waciInvitationId: string,
          holderId: string,
        ) => {
          Logger.log('🔄 WACI Protocol: Starting credential issuance', {
            invitationId: waciInvitationId,
            holderId,
          });

          const storedData = await waciIssueCredentialDataService.getData(
            waciInvitationId,
          );

          if (!storedData) {
            const errorMessage = `❌ No credential data found for invitation ID: ${waciInvitationId}`;
            Logger.error(errorMessage, null, {
              invitationId: waciInvitationId,
              holderId,
            });
          }

          const {
            issuerDid,
            nameDid,
            credentialSubject,
            options,
            styles,
            issuer,
          } = storedData;

          const issuerInfo = {
            id: issuerDid,
            name: nameDid ?? 'Credential Issuer',
            styles: issuer?.styles,
          };

          // Build the raw credential data for the webhook payload
          const credentialData = credentialBuilder.buildCredentialData(
            waciInvitationId,
            holderId,
            issuerInfo,
            credentialSubject,
            options,
            styles,
          );

          const credentialOffer = credentialBuilder.createCredentialOffer(
            waciInvitationId,
            holderId,
            issuerInfo,
            credentialSubject,
            options,
            styles,
          );

          Logger.log('✅ WACI Protocol: Credential issuance completed', {
            invitationId: waciInvitationId,
            holderId,
          });

          await outgoingWebhookService.sendCredentialIssuedWebhook(
            credentialData,
            holderId,
          );

          // TODO: Credentials invites can be one time or re-usable.
          // waciCredentialDataService.removeData(waciInvitationId);

          return credentialOffer;
        },
      },
      verifier: {
        presentationDefinition: async (invitationId: string) => {
          const storedPresentationData =
            await waciPresentationDataService.getData(invitationId);

          Logger.debug('Processing presentation definition', {
            invitationId,
            hasStoredData: !!storedPresentationData,
          });

          if (storedPresentationData) {
            return {
              inputDescriptors: storedPresentationData,
            };
          }
        },
      },
    });
  },
  inject: [
    CONFIG,
    WaciIssueCredentialDataMongoService,
    WaciPresentationMongoService,
    CredentialBuilderService,
    OutgoingWebhookService,
    INJECTION_TOKENS.WACI_PROTOCOL_STORAGE,
  ],
};
