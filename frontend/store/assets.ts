import { create } from 'zustand';

interface FormData {
  name: string;
  images: File[];
  category: {
    name: string;
    description: string;
    color: string;
  } | null;
  price: number;
  currency: string;
  owner: 'DEBUG';
}

export interface AssetsInterfce {
  assets: any[];
  total: number;
  getAssets: () => void;
  postAsset: () => void;
  removeAsset: (id: string) => void;
}

const useAssets = create(set => ({
  assets: [],
  limit: 0,
  total: 0,
  page: 0,
  getAssets: async () => {
    try {
      const token: string | null = sessionStorage.getItem('token');

      if (!token) return null;

      const limit = 0;
      const page = 0;

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/assets?limit=${limit}&page=${page}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          }
        }
      );
      const data = await response.json();

      const { assets, totalValue } = data;
      set((state: any) => ({
        assets: assets,
        total: totalValue
      }));
      return null;
    } catch (error) {
      console.log(error);
      return null;
    }
  },
  postAsset: async (formData: FormData) => {
    const formDataToSend = new FormData();

    try {
      const { name, category, price, currency, owner } = formData;

      formDataToSend.append(
        'data',
        JSON.stringify({
          name,
          category,
          value: price,
          currency,
          owner
        })
      );

      // if (imagePath) {
      //  const fileInfo = await FileSystem.getInfoAsync(imagePath);
      //  if (fileInfo.exists) {
      //    formDataToSend.append('images', {
      //      uri: imagePath,
      //      name: 'image.jpg',
      //      type: 'image/jpeg'
      //    } as any);
      //  }
      // }
    } catch (error) {
      console.log('');
    } finally {
      console.log('');
    }
  },
  removeAsset: async (id: string) => {
    try {
      const token: string | null = sessionStorage.getItem('token');

      if (!token) return null;

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/asset/delete/${id}`,
        {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          }
        }
      );

      console.log(response);
    } catch (error) {
      console.log(error);
    }
  }
}));

export { useAssets };
