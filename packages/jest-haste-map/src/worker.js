/**
 * Copyright (c) 2014-present, Facebook, Inc. All rights reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import type {HasteImpl, WorkerMessage, WorkerMetadata} from './types';

import path from 'path';
import * as docblock from 'jest-docblock';
import fs from 'graceful-fs';
import H from './constants';
import extractRequires from './lib/extract_requires';

const JSON_EXTENSION = '.json';
const PACKAGE_JSON = path.sep + 'package' + JSON_EXTENSION;

let hasteImpl: ?HasteImpl = null;
let hasteImplModulePath: ?string = null;

export async function worker(data: WorkerMessage): Promise<WorkerMetadata> {
  if (
    data.hasteImplModulePath &&
    data.hasteImplModulePath !== hasteImplModulePath
  ) {
    if (hasteImpl) {
      throw new Error('jest-haste-map: hasteImplModulePath changed');
    }
    hasteImplModulePath = data.hasteImplModulePath;
    // $FlowFixMe: dynamic require
    hasteImpl = (require(hasteImplModulePath): HasteImpl);
  }

  const filePath = data.filePath;
  const content = fs.readFileSync(filePath, 'utf8');
  let module;
  let id: ?string;
  let dependencies;

  if (filePath.endsWith(PACKAGE_JSON)) {
    const fileData = JSON.parse(content);
    if (fileData.name) {
      id = fileData.name;
      module = [filePath, H.PACKAGE];
    }
  } else if (!filePath.endsWith(JSON_EXTENSION)) {
    if (hasteImpl) {
      id = hasteImpl.getHasteName(filePath);
    } else {
      const doc = docblock.parse(docblock.extract(content));
      const idPragmas = [].concat(doc.providesModule || doc.provides);
      id = idPragmas[0];
    }
    dependencies = extractRequires(content);
    if (id) {
      module = [filePath, H.MODULE];
    }
  }

  return {dependencies, id, module};
}
