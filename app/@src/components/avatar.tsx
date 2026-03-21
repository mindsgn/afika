import { useMemo } from 'react';
import { View } from 'react-native';
import { createAvatar } from '@dicebear/core';
import { pixelArt } from '@dicebear/collection';
import { SvgXml } from 'react-native-svg';

export default function Avatar({ seed = 'John Doe',  size=50 }: {seed: string, size: number}) {
  const avatar = useMemo(() => {
    return createAvatar(pixelArt, {
      seed,
      size,
    }).toString();
  }, [seed]);

  return (
      <SvgXml xml={avatar} />
  );
}