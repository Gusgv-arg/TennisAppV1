const { Country, State, City } = require('country-state-city');

try {
  console.log('Testing Country.getCountryByCode(" ")');
  const c1 = Country.getCountryByCode(" ");
  console.log('c1:', c1);
} catch (e) {
  console.error('Error in Country.getCountryByCode:', e.message);
}

try {
  console.log('Testing State.getStateByCodeAndCountry(" ", " ")');
  const s1 = State.getStateByCodeAndCountry(" ", " ");
  console.log('s1:', s1);
} catch (e) {
  console.error('Error in State.getStateByCodeAndCountry:', e.message);
}
