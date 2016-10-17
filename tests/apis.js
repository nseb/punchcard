import test from 'ava';
import slugify from 'underscore.string/slugify';
import isEqual from 'lodash/isEqual';
import cloneDeep from 'lodash/cloneDeep';
import isUUID from 'validator/lib/isUUID';

import apiUtils from '../lib/api/utils';
import api from '../lib/api';
import database from '../lib/database';
import merged from './fixtures/live/objects/types-models-merged';
import dbmocks from './fixtures/live/objects/database-mocks.js';

const content = dbmocks.rows;
const types = merged.types;
const eachOfType = dbmocks.eachOfType;
const allTypes = merged.allTypes;

test.cb.before(t => {
  database.init().then(() => {
    database('live').insert(content).then(() => {
      t.end();
    }).catch(e => { // because we can't return in a before, this catch doesn't bubble out
      t.fail(e);
    });
  }).catch(e => {
    t.fail(e.message);
  });
});

//////////////////////////////
// Utils - attributes
//////////////////////////////
test('Utils: attributes', t => {
  const item = Math.round(Math.random() * content.length);
  const expected = cloneDeep(content[item]);
  const model = allTypes.find(typ => {
    return typ.id === expected['type-slug'];
  });
  const attributes = apiUtils.attributes(expected.attributes, model.attributes);

  t.is(typeof attributes, 'object', 'Should return an object.');
  Object.keys(attributes).map(key => {
    const attr = key.split('-');
    if (attr[attr.length - 1] === 'referencer') {
      t.true(isUUID(attributes[key]), 'includes a uuid');
    }
  });
});

//////////////////////////////
// Utils - format
//////////////////////////////
test('Utils: Format Results - List', t => {
  const formatted = apiUtils.format(content.slice(0, 9));

  formatted.forEach(item => {
    t.true(item.hasOwnProperty('id'), 'Contains ID');
    t.true(item.hasOwnProperty('type'), 'Contains Type');
    t.true(item.hasOwnProperty('type_slug'), 'Contains Type Slug');
    t.true(item.hasOwnProperty('key'), 'Contains Key');
    t.true(item.hasOwnProperty('key_slug'), 'Contains Key Slug');
    t.true(item.hasOwnProperty('meta'), 'Contains Meta');
    t.false(item.hasOwnProperty('attributes'), 'Does not contain attributes');
    t.is(item.meta.url, `/api/types/${item.type_slug}/${item.id}`, 'URL points to full content item');
  });
});

test('Utils: Format Results - Attributes', t => {
  const item = Math.round(Math.random() * content.length);
  const expected = cloneDeep(content[item]);
  const model = allTypes.find(typ => {
    return typ.id === expected['type-slug'];
  });

  const formatted = apiUtils.format([expected], model.attributes);

  formatted.forEach(itm => {
    t.true(itm.hasOwnProperty('id'), 'Contains ID');
    t.true(itm.hasOwnProperty('type'), 'Contains Type');
    t.true(itm.hasOwnProperty('type_slug'), 'Contains Type Slug');
    t.true(itm.hasOwnProperty('key'), 'Contains Key');
    t.true(itm.hasOwnProperty('key_slug'), 'Contains Key Slug');
    t.false(itm.hasOwnProperty('meta'), 'Does not contain Meta');
    t.true(itm.hasOwnProperty('attributes'), 'Contains attributes');
  });
});

//////////////////////////////
// Utils - organize
//////////////////////////////
test('Utils: Organize - Default', t => {
  const actual = apiUtils.organize();
  const expected = {
    sort: {
      by: 'key',
      dir: 'asc',
    },
    page: {
      offset: 0,
      limit: 30,
      page: 1,
    },
  };

  t.deepEqual(actual, expected, 'Returns defaults');
});

test('Utils: Organize - Lookup', t => {
  const actual = apiUtils.organize({}, [
    'foo',
    'bar',
    'baz',
  ]);
  const expected = {
    sort: {
      by: 'foo',
      dir: 'asc',
    },
    page: {
      offset: 0,
      limit: 30,
      page: 1,
    },
  };

  t.deepEqual(actual, expected, 'Returns defaults');
});

test('Utils: Organize - Bad Lookup', t => {
  const actual = apiUtils.organize({}, {});
  const expected = {
    sort: {
      by: 'key',
      dir: 'asc',
    },
    page: {
      offset: 0,
      limit: 30,
      page: 1,
    },
  };

  t.deepEqual(actual, expected, 'Returns defaults');
});

test('Utils: Organize - Custom', t => {
  const actual = apiUtils.organize({
    sort: 'type',
    sort_dir: 'desc', // eslint-disable-line camelcase
    page: 2,
    per_page: 50, // eslint-disable-line camelcase
  });

  const expected = {
    sort: {
      by: 'type',
      dir: 'desc',
    },
    page: {
      offset: 50,
      limit: 50,
      page: 2,
    },
  };

  t.deepEqual(actual, expected, 'Returns defaults');
});

test('Utils: Organize - Wrong', t => {
  const actual = apiUtils.organize({
    sort: 'foo',
    sort_dir: 'banana', // eslint-disable-line camelcase
    page: 0,
    per_page: 200, // eslint-disable-line camelcase
  });

  const expected = {
    sort: {
      by: 'key',
      dir: 'asc',
    },
    page: {
      offset: 0,
      limit: 100,
      page: 1,
    },
  };

  t.deepEqual(actual, expected, 'Returns defaults');
});

test('Utils: Organize - Wrong Pages', t => {
  const actual = apiUtils.organize({
    page: -1,
    per_page: -1, // eslint-disable-line camelcase
  });

  const expected = {
    sort: {
      by: 'key',
      dir: 'asc',
    },
    page: {
      offset: 0,
      limit: 1,
      page: 1,
    },
  };

  t.deepEqual(actual, expected, 'Returns defaults');
});

//////////////////////////////
// Utils - page
//////////////////////////////
test('Utils: Page - First', t => {
  const organized = apiUtils.organize();
  const actual = apiUtils.page('api', organized, 100);

  const expected = {
    first: '/api?sort=key&sort_dir=asc&per_page=30&page=1',
    prev: false,
    next: '/api?sort=key&sort_dir=asc&per_page=30&page=2',
    last: '/api?sort=key&sort_dir=asc&per_page=30&page=4',
  };


  t.deepEqual(actual, expected);
});

test('Utils: Page - Middle', t => {
  const organized = apiUtils.organize({
    page: 2,
  });
  const actual = apiUtils.page('api', organized, 100);

  const expected = {
    first: '/api?sort=key&sort_dir=asc&per_page=30&page=1',
    prev: '/api?sort=key&sort_dir=asc&per_page=30&page=1',
    next: '/api?sort=key&sort_dir=asc&per_page=30&page=3',
    last: '/api?sort=key&sort_dir=asc&per_page=30&page=4',
  };


  t.deepEqual(actual, expected);
});

test('Utils: Page - End', t => {
  const organized = apiUtils.organize({
    page: 4,
  });
  const actual = apiUtils.page('api', organized, 100);

  const expected = {
    first: '/api?sort=key&sort_dir=asc&per_page=30&page=1',
    prev: '/api?sort=key&sort_dir=asc&per_page=30&page=3',
    next: false,
    last: '/api?sort=key&sort_dir=asc&per_page=30&page=4',
  };


  t.deepEqual(actual, expected);
});

test('Utils: Page - One', t => {
  const organized = apiUtils.organize({
    page: 1,
  });
  const actual = apiUtils.page('api', organized, 30);

  const expected = {
    first: false,
    prev: false,
    next: false,
    last: false,
  };


  t.deepEqual(actual, expected);
});

test('Utils: Page - None', t => {
  const organized = apiUtils.organize({
    page: 4,
  });
  const actual = apiUtils.page('api', organized, 0);

  const expected = {
    first: false,
    prev: false,
    next: false,
    last: false,
  };


  t.deepEqual(actual, expected);
});

//////////////////////////////
// APIs
//////////////////////////////
test('APIs: Types', t => {
  const app = {
    get: word => {
      console.log(word); // eslint-disable-line no-console

      return allTypes;
    },
  };

  const keys = [
    'name',
    'description',
    'id',
  ];

  const apiTypes = api.types(app);

  t.true(apiTypes.hasOwnProperty('keys'), 'Has keys');
  t.true(apiTypes.hasOwnProperty('all'), 'Has All Content Types');
  t.true(isEqual(apiTypes.keys, keys), 'Keys are as expected');
});

test('API: All', t => {
  return api.all({}).then(results => {
    t.true(results.hasOwnProperty('items'), 'Has Items');
    t.true(results.hasOwnProperty('pages'), 'Has Pagination');
    t.is(results.items.length, 30, 'Has all 30 items in it');
  });
});

test('API: Content', t => {
  const app = {
    get: word => {
      console.log(word); // eslint-disable-line no-console

      return allTypes;
    },
  };

  const apiTypes = api.types(app);

  return api.content({}, apiTypes).then(formatted => {
    t.true(formatted.hasOwnProperty('items'), 'Has Items');
    t.true(formatted.hasOwnProperty('pages'), 'Has Pagination');
    t.is(formatted.items.length, allTypes.length, 'All content types exist');
  });
});

test('API: Content - Descending', t => {
  const app = {
    get: word => {
      console.log(word); // eslint-disable-line no-console

      return allTypes;
    },
  };

  const apiTypes = api.types(app);

  return api.content({
    sort_dir: 'desc', // eslint-disable-line camelcase
  }, apiTypes).then(formatted => {
    t.true(formatted.hasOwnProperty('items'), 'Has Items');
    t.true(formatted.hasOwnProperty('pages'), 'Has Pagination');
    t.is(formatted.items.length, allTypes.length, 'All content types exist');
  });
});

test('API: ofType', t => {
  const item = Math.round(Math.random() * types.length);

  return api.ofType({}, slugify(types[item])).then(formatted => {
    t.true(formatted.hasOwnProperty('items'), 'Has Items');
    t.true(formatted.hasOwnProperty('pages'), 'Has Pagination');

    if (eachOfType[types[item]] > 30) {
      t.is(formatted.items.length, 30, 'Has all available items');
    }
    else {
      t.is(formatted.items.length, eachOfType[types[item]], 'Has all available items');
    }
  });
});

test('API: One', t => {
  const item = Math.round(Math.random() * content.length);
  const expected = content[item];

  return api.one({}, expected.id, allTypes[0].attributes).then(result => {
    t.is(result.id, expected.id, 'IDs the same');
    t.true(result.hasOwnProperty('attributes'));
    t.is(result.key, expected.key, 'Key available');
    t.true(result.hasOwnProperty('type'), 'Has type info');
  });
});

test('API: One - Not There', t => {
  return api.one({}, `Test ${Math.round(Math.random() * content.length)}`).then(result => {
    t.deepEqual(result, {}, 'Empty object returned');
  });
});

test.cb.after(t => {
  const promises = types.map(type => {
    return database('live').where('type', type).del();
  });

  Promise.all(promises).then(() => {
    t.end();
  }).catch(e => {
    console.error(e); // esling-disable-line no-console
    t.end();
  });
});
