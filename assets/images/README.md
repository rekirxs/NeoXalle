Place the attached image file here as `stool.png`.

Path (workspace-relative): assets/images/stool.png

On Windows you can save the attachment to:
C:\Users\<you>\OneDrive\Escritorio\NeoXalle\assets\images\stool.png

Example usage in a React Native / Expo component:

```tsx
import React from 'react';
import { Image } from 'react-native';

export default function StoolImage() {
  // Use require with a static path
  return (
    <Image
      source={require('../../assets/images/stool.png')}
      style={{ width: 300, height: 200, resizeMode: 'contain' }}
    />
  );
}
```

Notes:
- Save the image exactly as `stool.png` in this folder.
- If bundling fails because the file is missing, add the image then restart the packager.
- If you prefer, I can add the actual binary image file into the repo — tell me and I'll place it at `assets/images/stool.png`.