/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    SSM,
    SSMClient,
    Session,
    StartSessionCommand,
    TerminateSessionCommand,
    TerminateSessionResponse,
    StartSessionCommandOutput,
    DescribeInstanceInformationCommand,
    DescribeInstanceInformationCommandInput,
    InstanceInformation,
    SendCommandCommand,
    SendCommandCommandOutput,
    waitUntilCommandExecuted,
    SessionState,
    DescribeSessionsCommand,
    DescribeSessionsCommandInput,
} from '@aws-sdk/client-ssm'
import { WaiterState } from '@smithy/util-waiter'
import { pageableToCollection } from '../utilities/collectionUtils'
import { ToolkitError } from '../errors'
import { ClientWrapper } from './client'

export class SSMWrapper extends ClientWrapper<SSM> {
    public constructor(public override readonly regionCode: string) {
        super(regionCode, SSMClient)
    }

    public async terminateSession(session: Session): Promise<TerminateSessionResponse> {
        const sessionId = session.SessionId!
        return await this.terminateSessionFromId(sessionId)
    }

    public async terminateSessionFromId(sessionId: string): Promise<TerminateSessionResponse> {
        return await this.makeRequest(TerminateSessionCommand, { SessionId: sessionId })
    }

    public async startSession(
        target: string,
        document?: string,
        reason?: string,
        parameters?: Record<string, string[]>
    ): Promise<StartSessionCommandOutput> {
        return await this.makeRequest(StartSessionCommand, {
            Target: target,
            DocumentName: document,
            Reason: reason,
            Parameters: parameters,
        })
    }

    public async describeInstance(target: string): Promise<InstanceInformation> {
        const client = await this.getClient()
        const requester = async (req: DescribeInstanceInformationCommandInput) => {
            const command = new DescribeInstanceInformationCommand(req)
            return await client.send(command)
        }
        const request: DescribeInstanceInformationCommandInput = {
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
        parameters: Record<string, string[]>
    ): Promise<SendCommandCommandOutput> {
        return await this.makeRequest(SendCommandCommand, {
            InstanceIds: [target],
            DocumentName: documentName,
            Parameters: parameters,
        })
    }

    private async waitUntilCommandExecuted(commandId: string, target: string) {
        const result = await waitUntilCommandExecuted(
            { client: await this.getClient(), maxWaitTime: 30 },
            { CommandId: commandId, InstanceId: target }
        )
        if (result.state !== WaiterState.SUCCESS) {
            throw new ToolkitError(`Command ${commandId} failed to execute on target ${target}`)
        }
    }

    public async sendCommandAndWait(
        target: string,
        documentName: string,
        parameters: Record<string, string[]>
    ): Promise<SendCommandCommandOutput> {
        const response = await this.sendCommand(target, documentName, parameters)
        try {
            await this.waitUntilCommandExecuted(response.Command!.CommandId!, target)
            return response
        } catch (err) {
            throw new ToolkitError(`Failed in sending command to target ${target}`, { cause: err as Error })
        }
    }

    public async getInstanceAgentPingStatus(target: string): Promise<string> {
        const instanceInformation = await this.describeInstance(target)
        return instanceInformation ? instanceInformation.PingStatus! : 'Inactive'
    }

    public async describeSessions(state: SessionState) {
        const client = await this.getClient()
        const requester = async (req: DescribeSessionsCommandInput) => {
            const command = new DescribeSessionsCommand(req)
            return await client.send(command)
        }

        const response = await pageableToCollection(
            requester,
            { State: state },
            'NextToken' as never,
            'Sessions'
        ).promise()

        return response
    }
}
