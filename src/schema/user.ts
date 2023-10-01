export const user = {
  title: 'user',
  version: 0,
  description: 'user wallet details',
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: {
      type: 'string',
      maxLength: '128',
    },
  },
  required: ['id'],
};
