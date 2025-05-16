import { FactoryProvider } from '@nestjs/common';
import { CONFIG, Configuration } from '../config';
import { FileSystemStorage } from '../storage/filesystem-storage';
import {
  Agent,
  AgentSecureStorage,
  AgentModenaUniversalRegistry,
  AgentModenaUniversalResolver,
  WACIProtocol,
  WebsocketServerTransport,
  WebsocketClientTransport,
} from '@extrimian/agent';

export const AgentProvider: FactoryProvider<Agent> = {
  provide: Agent,
  inject: [
    'AGENT_SECURE_STORAGE',
    WACIProtocol,
    WebsocketServerTransport,
    CONFIG,
  ],
  useFactory: async (
    secureStorage: AgentSecureStorage,
    waciProtocol: WACIProtocol,
    transport: WebsocketServerTransport,
    config: Configuration,
  ) => {
    const agent = new Agent({
      didDocumentRegistry: new AgentModenaUniversalRegistry(config.MODENA_URL),
      didDocumentResolver: new AgentModenaUniversalResolver(config.MODENA_URL),
      vcProtocols: [waciProtocol],
      supportedTransports: [new WebsocketClientTransport()],
      agentStorage: new FileSystemStorage({
        filepath: './storage/agent-storage.json',
      }),
      vcStorage: new FileSystemStorage({
        filepath: './vc-storage.json',
      }),
      secureStorage,
    });

    await agent.initialize();
    const dids = agent.identity.getDIDs();
    if (!dids.length) {
      await agent.identity.createNewDID({
        didMethod: config.DID_METHOD,
        dwnUrl: config.DWN_URL,
        services: config.WEBSOCKET_ENDPOINT_URL
          ? [
              {
                id: 'websocket',
                type: config.WEBSOCKET_ENDPOINT_ID,
                serviceEndpoint: config.WEBSOCKET_ENDPOINT_URL,
              },
            ]
          : undefined,
      });
    }

    agent.vc.ackCompleted.on((param) => {
      console.log('ack completed', param);
    });

    agent.vc.presentationVerified.on((param) => {
      console.log('ack completed', param);
    });

    agent.vc.credentialArrived.on(async (vcs) => {
      await Promise.all(
        vcs.credentials.map((vc) => {
          agent.vc.saveCredentialWithInfo(vc.data, {
            styles: vc.styles,
            display: vc.display,
          });
        }),
      );
    });

    agent.vc.credentialPresented.on((data) => {
      console.log('Credential presented:', {
        vcVerified: data.vcVerified,
        presentationVerified: data.presentationVerified,
        vcId: data.vc.id,
      });
    });

    agent.vc.problemReport.on((data) => {
      console.error('Problem report received:', {
        did: data.did.value,
        code: data.code,
        invitationId: data.invitationId,
        messageId: data.messageId,
      });
    });

    // Log when credentials arrive
    agent.vc.credentialArrived.on((data) => {
      console.log('Credentials arrived:', {
        count: data.credentials.length,
        issuer: data.issuer.name,
        messageId: data.messageId,
      });
    });

    return agent;
  },
};
