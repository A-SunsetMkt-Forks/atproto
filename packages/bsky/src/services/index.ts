import { Database } from '../db'
import { ImageUriBuilder } from '../image/uri'
import { ActorService } from './actor'
import { FeedService } from './feed'
import { GraphService } from './graph'
import { LabelService } from './label'
import { ImageInvalidator } from '../image/invalidator'
import { LabelCache } from '../label-cache'

export function createServices(resources: {
  imgUriBuilder: ImageUriBuilder
  imgInvalidator: ImageInvalidator
  labelCache: LabelCache
}): Services {
  const { imgUriBuilder, labelCache } = resources
  return {
    actor: ActorService.creator(imgUriBuilder, labelCache),
    feed: FeedService.creator(imgUriBuilder, labelCache),
    graph: GraphService.creator(imgUriBuilder),
    label: LabelService.creator(labelCache),
  }
}

export type Services = {
  actor: FromDb<ActorService>
  feed: FromDb<FeedService>
  graph: FromDb<GraphService>
  label: FromDb<LabelService>
}

type FromDb<T> = (db: Database) => T
