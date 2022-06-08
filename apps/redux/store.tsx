import { createStore } from 'redux';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { persistStore, persistReducer } from 'redux-persist';
import wallet from './reducer/wallet.reducer';

const persistConfig = {
    key: 'persistedReducer',
    storage: AsyncStorage
};

const persistedReducer = persistReducer(persistConfig, wallet);
const store = createStore(persistedReducer);
let persistor = persistStore(store);

export { store, persistor };
