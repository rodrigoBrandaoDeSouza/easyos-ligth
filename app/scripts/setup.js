// Instala o Expo e todas as dependências nas versões compatíveis com o SDK atual.
// Uso: npm run setup   (rode uma única vez, com internet)
const { execSync } = require('node:child_process');
const run = (cmd) => {
  console.log(`\n> ${cmd}`);
  execSync(cmd, { stdio: 'inherit', shell: true });
};

run('npm install expo@latest');
run(
  'npx expo install react react-native expo-router expo-linking expo-constants expo-status-bar ' +
    'react-native-safe-area-context react-native-screens expo-sqlite expo-crypto expo-print expo-sharing ' +
    '@supabase/supabase-js react-native-url-polyfill @react-native-async-storage/async-storage ' +
    '@react-native-community/netinfo @react-native-community/datetimepicker ' +
    'react-native-signature-canvas react-native-webview react-native-purchases expo-dev-client'
);
run('npx expo install -- --save-dev typescript @types/react');
run('npx expo install --fix');
console.log('\nPronto! Configure o arquivo .env e rode: npm start');
