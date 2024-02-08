import Database from '../db'
import { PlivoClient } from './plivo'
import { TwilioClient } from './twilio'
import { SECOND } from '@atproto/common'
import { randomIntFromSeed } from '@atproto/crypto'
import { PhoneVerifier } from './util'

const PLIVO_RATIO_FLAG = 'phone-verification:plivoRatio'

export class MultiVerifier implements PhoneVerifier {
  plivoRatio = 0
  lastRefreshed = 0

  constructor(
    public db: Database,
    public twilio: TwilioClient,
    public plivo: PlivoClient,
  ) {}

  async checkRefreshRatio() {
    if (Date.now() - this.lastRefreshed > 30 * SECOND) {
      await this.refreshRatio()
    }
  }

  async refreshRatio() {
    const res = await this.db.db
      .selectFrom('runtime_flag')
      .where('name', '=', PLIVO_RATIO_FLAG)
      .selectAll()
      .executeTakeFirst()
    this.plivoRatio = parseMaybeInt(res?.value)
    this.lastRefreshed = Date.now()
  }

  async sendCode(phoneNumber: string) {
    await this.checkRefreshRatio()
    const id = await randomIntFromSeed(phoneNumber, 10, 0)
    if (id < this.plivoRatio) {
      await this.plivo.sendCode(phoneNumber)
    } else {
      await this.twilio.sendCode(phoneNumber)
    }
  }

  async verifyCode(phoneNumber: string, code: string) {
    await this.checkRefreshRatio()
    const id = await randomIntFromSeed(phoneNumber, 10, 0)
    const firstTry =
      id < this.plivoRatio
        ? () => this.plivo.verifyCode(phoneNumber, code)
        : () => this.twilio.verifyCode(phoneNumber, code)
    const secondTry =
      id < this.plivoRatio
        ? () => this.plivo.verifyCode(phoneNumber, code)
        : () => this.twilio.verifyCode(phoneNumber, code)
    try {
      return await firstTry()
    } catch {
      return await secondTry()
    }
  }
}

const parseMaybeInt = (str?: string): number => {
  if (!str) return 0
  const parsed = parseInt(str)
  if (isNaN(parsed) || parsed < 0) {
    return 0
  }
  return parsed
}