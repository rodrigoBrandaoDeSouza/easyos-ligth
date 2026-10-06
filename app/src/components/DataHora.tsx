import React, { useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { dataHoraBR } from '@/lib/format';
import { cores } from '@/lib/theme';
import { s } from './ui';

/** Seleção de data + hora (Android: dois diálogos; iOS: seletor embutido). */
export function DataHora({
  rotulo,
  valor,
  onChange,
}: {
  rotulo: string;
  valor: Date;
  onChange: (d: Date) => void;
}) {
  const [mostrarIOS, setMostrarIOS] = useState(false);

  function abrir() {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: valor,
        mode: 'date',
        onChange: (ev, data) => {
          if (ev.type !== 'set' || !data) return;
          DateTimePickerAndroid.open({
            value: data,
            mode: 'time',
            is24Hour: true,
            onChange: (ev2, hora) => {
              if (ev2.type !== 'set' || !hora) return;
              const r = new Date(data);
              r.setHours(hora.getHours(), hora.getMinutes(), 0, 0);
              onChange(r);
            },
          });
        },
      });
    } else {
      setMostrarIOS((v) => !v);
    }
  }

  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={s.rotulo}>{rotulo} *</Text>
      <Pressable style={[s.input, { justifyContent: 'center' }]} onPress={abrir}>
        <Text style={{ color: cores.texto }}>{dataHoraBR(valor.toISOString())}</Text>
      </Pressable>
      {Platform.OS === 'ios' && mostrarIOS && (
        <DateTimePicker
          value={valor}
          mode="datetime"
          display="inline"
          locale="pt-BR"
          minuteInterval={5}
          onChange={(_ev, d) => d && onChange(d)}
        />
      )}
    </View>
  );
}
