import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Logger } from '../utils/logger';
import { WaciIssueCredentialData } from '../schemas/waci-issue-credential-data.schema';
import { IssuerInfo } from '../services/credential-builder.service';

interface StoredCredentialData {
  issuerDid?: string;
  nameDid?: string;
  credentialSubject: any;
  options: {
    expirationDays?: number;
    oneTimeUse?: boolean;
    displayTitle?: string;
    displaySubtitle?: string;
    displayDescription?: string;
    type: string[];
    heroImage?: string;
  };
  styles?: any;
  issuer?: IssuerInfo;
}

@Injectable()
export class IssuedCredentialMongoStorage {
  constructor(
    @InjectModel(WaciIssueCredentialData.name)
    private waciIssueCredentialDataModel: Model<WaciIssueCredentialData>,
  ) {}

  async storeData(
    invitationId: string,
    data: StoredCredentialData,
  ): Promise<void> {
    try {
      await this.waciIssueCredentialDataModel.findOneAndUpdate(
        { invitationId },
        { invitationId, ...data },
        { upsert: true, new: true },
      );
      Logger.debug('Stored issue credential data', { invitationId });
    } catch (error) {
      Logger.error('Failed to store issue credential data', error, {
        invitationId,
      });
      throw error;
    }
  }

  async getData(
    invitationId: string,
  ): Promise<StoredCredentialData | undefined> {
    try {
      const doc = await this.waciIssueCredentialDataModel.findOne({
        invitationId,
      });
      return doc ? (doc.toObject() as StoredCredentialData) : undefined;
    } catch (error) {
      Logger.error('Failed to get issue credential data', error, {
        invitationId,
      });
      throw error;
    }
  }

  async removeData(invitationId: string): Promise<void> {
    try {
      await this.waciIssueCredentialDataModel.deleteOne({ invitationId });
      Logger.debug('Removed issue credential data', { invitationId });
    } catch (error) {
      Logger.error('Failed to remove issue credential data', error, {
        invitationId,
      });
      throw error;
    }
  }
}

export { StoredCredentialData };
