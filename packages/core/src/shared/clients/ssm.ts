/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { SSM, SSMClient, Session, TerminateSessionCommand, TerminateSessionResponse } from '@aws-sdk/client-ssm'
import { pageableToCollection } from '../utilities/collectionUtils'
import { PromiseResult } from 'aws-sdk/lib/request'
import { ToolkitError } from '../errors'
import { ClientWrapper } from './client'
import { globals } from '..'

export class SSMWrapper extends ClientWrapper<SSM> {
    public constructor(public override readonly regionCode: string) {
        super(regionCode, SSMClient)
    }

    public async terminateSession(session: Session): Promise<TerminateSessionResponse> {
        //const c = await globals.sdkClientBuilderV3.createAwsService(SSMClient, undefined, 'us-west-1')
        const sessionId = session.SessionId!
        return await this.terminateSessionFromId(sessionId)
    }

    public async terminateSessionFromId(sessionId: string): Promise<TerminateSessionResponse> {
        const client = await this.getClient()
        const command = new TerminateSessionCommand({ SessionId: sessionId })
        const termination = await client.send(command)
        return termination!
    }

    public async startSession(
        target: string,
        document?: string,
        parameters?: SSM.SessionManagerParameters
    ): Promise<SSM.StartSessionResponse> {
        const client = await this.createSdkClient()
        const response = await client
            .startSession({ Target: target, DocumentName: document, Parameters: parameters })
            .promise()
        return response
    }

    public async describeInstance(target: string): Promise<SSM.InstanceInformation> {
        const client = await this.createSdkClient()
        const requester = async (req: SSM.DescribeInstanceInformationRequest) =>
            client.describeInstanceInformation(req).promise()
        const request: SSM.DescribeInstanceInformationRequest = {
            InstanceInformationFilterList: [
                {
                    key: 'InstanceIds',
                    valueSet: [target],
                },
            ],
        }

        const response = await pageableToCollection(requester, request, 'NextToken', 'InstanceInformationList')
            .flatten()
            .flatten()
            .promise()
        return response[0]!
    }

    public async getTargetPlatformName(target: string): Promise<string> {
        const instanceInformation = await this.describeInstance(target)
        return instanceInformation.PlatformName!
    }

    public async sendCommand(
        target: string,
        documentName: string,
        parameters: SSM.Parameters
    ): Promise<SSM.SendCommandResult> {
        const client = await this.createSdkClient()
        const response = await client
            .sendCommand({ InstanceIds: [target], DocumentName: documentName, Parameters: parameters })
            .promise()
        return response
    }

    public async sendCommandAndWait(
        target: string,
        documentName: string,
        parameters: SSM.Parameters
    ): Promise<PromiseResult<SSM.GetCommandInvocationResult, AWSError>> {
        const response = await this.sendCommand(target, documentName, parameters)
        const client = await this.createSdkClient()
        try {
            const commandId = response.Command!.CommandId!
            const result = await client
                .waitFor('commandExecuted', { CommandId: commandId, InstanceId: target })
                .promise()
            return result
        } catch (err) {
            throw new ToolkitError(`Failed in sending command to target ${target}`, { cause: err as Error })
        }
    }

    public async getInstanceAgentPingStatus(target: string): Promise<string> {
        const instanceInformation = await this.describeInstance(target)
        return instanceInformation ? instanceInformation.PingStatus! : 'Inactive'
    }

    public async describeSessions(state: SSM.SessionState) {
        const client = await this.createSdkClient()
        const requester = async (req: SSM.DescribeSessionsRequest) => client.describeSessions(req).promise()

        const response = await pageableToCollection(requester, { State: state }, 'NextToken', 'Sessions').promise()

        return response
    }
}
