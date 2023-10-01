const apiUrl = 'https://api.coingecko.com/api/v3/coins/markets';
const params = {
  vs_currency: 'eur',
  category: 'ethereum-ecosystem',
  order: 'market_cap_desc',
  per_page: 100,
  page: 1,
  sparkline: true,
  locale: 'en',
  precision: 'full',
};

export { apiUrl, params };
