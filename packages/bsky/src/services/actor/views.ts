import { ArrayEl } from '@atproto/common'
import {
  ProfileViewDetailed,
  ProfileView,
  ProfileViewBasic,
} from '../../lexicon/types/app/bsky/actor/defs'
import Database from '../../db'
import { countAll } from '../../db/util'
import { Actor } from '../../db/tables/actor'
import { ImageUriBuilder } from '../../image/uri'

export class ActorViews {
  constructor(private db: Database, private imgUriBuilder: ImageUriBuilder) {}

  profileDetailed(
    result: ActorResult,
    viewer: string,
  ): Promise<ProfileViewDetailed>
  profileDetailed(
    result: ActorResult[],
    viewer: string,
  ): Promise<ProfileViewDetailed[]>
  async profileDetailed(
    result: ActorResult | ActorResult[],
    viewer: string,
  ): Promise<ProfileViewDetailed | ProfileViewDetailed[]> {
    const results = Array.isArray(result) ? result : [result]
    if (results.length === 0) return []

    const { ref } = this.db.db.dynamic

    const profileInfos = await this.db.db
      .selectFrom('actor')
      .where(
        'actor.did',
        'in',
        results.map((r) => r.did),
      )
      .leftJoin('profile', 'profile.creator', 'actor.did')
      .select([
        'actor.did as did',
        'profile.uri as profileUri',
        'profile.displayName as displayName',
        'profile.description as description',
        'profile.avatarCid as avatarCid',
        'profile.bannerCid as bannerCid',
        'profile.indexedAt as indexedAt',
        this.db.db
          .selectFrom('follow')
          .whereRef('creator', '=', ref('actor.did'))
          .select(countAll.as('count'))
          .as('followsCount'),
        this.db.db
          .selectFrom('follow')
          .whereRef('subjectDid', '=', ref('actor.did'))
          .select(countAll.as('count'))
          .as('followersCount'),
        this.db.db
          .selectFrom('post')
          .whereRef('creator', '=', ref('actor.did'))
          .select(countAll.as('count'))
          .as('postsCount'),
        this.db.db
          .selectFrom('follow')
          .where('creator', '=', viewer)
          .whereRef('subjectDid', '=', ref('actor.did'))
          .select('uri')
          .as('requesterFollowing'),
        this.db.db
          .selectFrom('follow')
          .whereRef('creator', '=', ref('actor.did'))
          .where('subjectDid', '=', viewer)
          .select('uri')
          .as('requesterFollowedBy'),
      ])
      .execute()

    const profileInfoByDid = profileInfos.reduce((acc, info) => {
      return Object.assign(acc, { [info.did]: info })
    }, {} as Record<string, ArrayEl<typeof profileInfos>>)

    const views = results.map((result) => {
      const profileInfo = profileInfoByDid[result.did]
      const avatar = profileInfo?.avatarCid
        ? this.imgUriBuilder.getCommonSignedUri(
            'avatar',
            profileInfo.did,
            profileInfo.avatarCid,
          )
        : undefined
      const banner = profileInfo?.bannerCid
        ? this.imgUriBuilder.getCommonSignedUri(
            'banner',
            profileInfo.did,
            profileInfo.bannerCid,
          )
        : undefined
      return {
        did: result.did,
        handle: result.handle,
        displayName: profileInfo?.displayName || undefined,
        description: profileInfo?.description || undefined,
        avatar,
        banner,
        followsCount: profileInfo?.followsCount ?? 0,
        followersCount: profileInfo?.followersCount ?? 0,
        postsCount: profileInfo?.postsCount ?? 0,
        indexedAt: profileInfo?.indexedAt || undefined,
        viewer: {
          following: profileInfo?.requesterFollowing || undefined,
          followedBy: profileInfo?.requesterFollowedBy || undefined,
          // muted field hydrated on pds
        },
      }
    })

    return Array.isArray(result) ? views : views[0]
  }

  profile(result: ActorResult, viewer: string): Promise<ProfileView>
  profile(result: ActorResult[], viewer: string): Promise<ProfileView[]>
  async profile(
    result: ActorResult | ActorResult[],
    viewer: string,
  ): Promise<ProfileView | ProfileView[]> {
    const results = Array.isArray(result) ? result : [result]
    if (results.length === 0) return []

    const { ref } = this.db.db.dynamic

    const profileInfos = await this.db.db
      .selectFrom('actor')
      .where(
        'actor.did',
        'in',
        results.map((r) => r.did),
      )
      .leftJoin('profile', 'profile.creator', 'actor.did')
      .select([
        'actor.did as did',
        'profile.uri as profileUri',
        'profile.displayName as displayName',
        'profile.description as description',
        'profile.avatarCid as avatarCid',
        'profile.indexedAt as indexedAt',
        this.db.db
          .selectFrom('follow')
          .where('creator', '=', viewer)
          .whereRef('subjectDid', '=', ref('actor.did'))
          .select('uri')
          .as('requesterFollowing'),
        this.db.db
          .selectFrom('follow')
          .whereRef('creator', '=', ref('actor.did'))
          .where('subjectDid', '=', viewer)
          .select('uri')
          .as('requesterFollowedBy'),
      ])
      .execute()

    const profileInfoByDid = profileInfos.reduce((acc, info) => {
      return Object.assign(acc, { [info.did]: info })
    }, {} as Record<string, ArrayEl<typeof profileInfos>>)

    const views = results.map((result) => {
      const profileInfo = profileInfoByDid[result.did]
      const avatar = profileInfo?.avatarCid
        ? this.imgUriBuilder.getCommonSignedUri(
            'avatar',
            profileInfo.did,
            profileInfo.avatarCid,
          )
        : undefined
      return {
        did: result.did,
        handle: result.handle,
        displayName: profileInfo?.displayName || undefined,
        description: profileInfo?.description || undefined,
        avatar,
        indexedAt: profileInfo?.indexedAt || undefined,
        viewer: {
          following: profileInfo?.requesterFollowing || undefined,
          followedBy: profileInfo?.requesterFollowedBy || undefined,
          // muted field hydrated on pds
        },
      }
    })

    return Array.isArray(result) ? views : views[0]
  }

  // @NOTE keep in sync with feedService.getActorViews()
  profileBasic(result: ActorResult, viewer: string): Promise<ProfileViewBasic>
  profileBasic(
    result: ActorResult[],
    viewer: string,
  ): Promise<ProfileViewBasic[]>
  async profileBasic(
    result: ActorResult | ActorResult[],
    viewer: string,
  ): Promise<ProfileViewBasic | ProfileViewBasic[]> {
    const results = Array.isArray(result) ? result : [result]
    if (results.length === 0) return []

    const profiles = await this.profile(results, viewer)
    const views = profiles.map((view) => ({
      did: view.did,
      handle: view.handle,
      displayName: view.displayName,
      avatar: view.avatar,
      viewer: view.viewer,
    }))

    return Array.isArray(result) ? views : views[0]
  }
}

type ActorResult = Actor
