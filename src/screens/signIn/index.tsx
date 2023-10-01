import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import PhoneInput from 'react-native-international-phone-number';
import { phone } from 'phone';

import { colors } from '../../constants';
import { style } from './style';
import { useAuth } from '../../context';

const SignIn = (props: any) => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isValid, setIsValid] = useState(false);
  const { navigation, route } = props;
  const { auth, setAuth } = useAuth();
  const { params } = route;
  const { MagicKey } = params;
  const [selectedCountry, setSelectedCountry] = useState({
    callingCode: '+27',
    cca2: 'ZA',
    flag: '🇿🇦',
    name: {
      bg: 'Южна Африка',
      by: 'Паўднёвая Афрыка',
      cn: '南非',
      cz: 'Jižní Afrika',
      de: 'Südafrika',
      ee: 'Lõuna-Aafrika',
      el: 'Νότια Αφρική',
      en: 'South Africa',
      es: 'Sudáfrica',
      fr: 'Afrique du Sud',
      he: 'דרום אפריקה',
      it: 'Sud Africa',
      jp: '南アフリカ',
      nl: 'Zuid-Afrika',
      pl: 'Afryka Południowa',
      pt: 'África do Sul',
      ro: 'Africa de Sud',
      ru: 'Южная Африка',
      ua: 'Південна Африка',
      zh: '南非',
    },
  });

  function handleSelectedCountry(country: any) {
    setSelectedCountry(country);
  }

  const connectWithMagic = async () => {
    try {
      const response = await MagicKey.auth.loginWithSMS({
        phoneNumber: `${selectedCountry.callingCode} ${phoneNumber}`,
      });
      await setAuth(response);
    } catch (error) {
      setIsValid(false);
      await setPhoneNumber('');
      await setAuth(null);
    }
  };

  useEffect(() => {
    if (auth) {
      navigation.replace('HomeTabs');
    }
  }, [auth]);

  useEffect(() => {
    const result = phone(`${selectedCountry.callingCode} ${phoneNumber}`);
    setIsValid(result.isValid);
    if (isValid) {
      connectWithMagic();
    }
  }, [phoneNumber, isValid]);

  return (
    <View style={style.default}>
      <View>
        <Text
          style={[
            {
              fontFamily: 'SF-Pro-Rounded-Heavy',
              fontSize: 100,
              color: 'white',
            },
          ]}
        >
          ORBYT
        </Text>
        <View style={style.tagContainer}>
          <Text
            style={[
              {
                fontFamily: 'SF-Pro-Rounded-Regular',
                fontSize: 16,
                color: 'white',
              },
            ]}
          >
            Welcome, To get Started, Sign in using your phone number.
          </Text>
        </View>
      </View>

      {isValid ? (
        <ActivityIndicator size="large" />
      ) : (
        <View style={style.phoneNumberContainer}>
          <PhoneInput
            value={phoneNumber}
            onChangePhoneNumber={(number) => {
              setPhoneNumber(number);
            }}
            defaultCountry={'ZA'}
            selectedCountry={selectedCountry}
            onChangeSelectedCountry={handleSelectedCountry}
            inputStyle={{
              color: '#F3F3F3',
            }}
            containerStyle={{
              backgroundColor: colors.black,
              borderWidth: 0,
              height: 70,
            }}
            flagContainerStyle={{
              borderTopLeftRadius: 7,
              borderBottomLeftRadius: 7,
              backgroundColor: '#808080',
              justifyContent: 'center',
              height: 70,
            }}
            flagTextStyle={{
              fontSize: 16,
              fontWeight: 'bold',
              color: '#F3F3F3',
            }}
            modalStyle={{
              modal: {
                backgroundColor: '#333333',
                borderWidth: 1,
              },
              backdrop: {},
              divider: {
                backgroundColor: 'transparent',
              },
              countriesList: {},
              searchInput: {
                borderRadius: 8,
                borderWidth: 1,
                borderColor: '#F3F3F3',
                color: '#F3F3F3',
                backgroundColor: '#333333',
                paddingHorizontal: 12,
                height: 46,
              },
              countryButton: {
                borderWidth: 1,
                borderColor: '#F3F3F3',
                backgroundColor: '#666666',
                marginVertical: 4,
                paddingVertical: 0,
              },
              noCountryText: {},
              noCountryContainer: {},
              flag: {
                color: '#FFFFFF',
                fontSize: 20,
              },
              callingCode: {
                color: '#F3F3F3',
              },
              countryName: {
                color: '#F3F3F3',
              },
            }}
          />
        </View>
      )}
    </View>
  );
};

export { SignIn };
