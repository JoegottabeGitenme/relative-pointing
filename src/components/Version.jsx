// src/components/Version.jsx
// Displays the app version

import packageJson from '../../package.json';

function Version({ className = '' }) {
  return (
    <span className={`text-xs text-gray-400 dark:text-gray-500 ${className}`}>
      v{packageJson.version}
    </span>
  );
}

export default Version;
