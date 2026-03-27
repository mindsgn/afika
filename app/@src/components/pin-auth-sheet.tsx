import { useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { BodyText, Input, PrimaryButton } from '@/@src/components/Primitives';

type Props = {
  visible: boolean;
  title: string;
  onCancel: () => void;
  onConfirm: (pin: string) => Promise<boolean>;
};

export default function PinAuthSheet({ visible, title, onCancel, onConfirm }: Props) {
  const [pin, setPin] = useState('');
  const [status, setStatus] = useState('');

  const submit = async () => {
    const ok = await onConfirm(pin.trim());
    if (!ok) {
      setStatus('Incorrect PIN. Try again.');
      return;
    }

    setPin('');
    setStatus('');
  };

  const cancel = () => {
    setPin('');
    setStatus('');
    onCancel();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={cancel}>
      <View style={styles.backdrop}>
        <View style={styles.sheet} testID="pin-auth-sheet">
          <BodyText style={styles.title}>{title}</BodyText>
          <Input
            testID="pin-auth-input"
            value={pin}
            onChangeText={setPin}
            placeholder="Enter PIN"
            keyboardType="number-pad"
            secureTextEntry
            maxLength={5}
            autoFocus
          />
          {status ? <BodyText style={styles.status}>{status}</BodyText> : null}
          <PrimaryButton testID="pin-auth-confirm" label="Confirm" onPress={submit} />
          <PrimaryButton testID="pin-auth-cancel" label="Cancel" onPress={cancel} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    padding: 16,
    gap: 8,
    backgroundColor: '#0F1117',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  title: {
    fontSize: 16,
    color: '#E5E7EB',
  },
  status: {
    color: '#FCA5A5',
    fontSize: 12,
  },
});
