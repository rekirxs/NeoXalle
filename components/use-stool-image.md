Usage snippet showing how to include the attached image in your project.

Place the attached image at: `assets/images/stool.png`

Import example (path from a file in `components/`):

```tsx
import React from 'react';
import { View, Image } from 'react-native';

export default function Example() {
  return (
    <View>
      <Image
        source={require('../assets/images/stool.png')}
        style={{ width: 300, height: 200, resizeMode: 'contain' }}
      />
    </View>
  );
}
```

If you want, I can place the binary image into `assets/images/stool.png` for you — I currently cannot write the attachment binary automatically; if you'd like me to add it, reply and I'll add the file to the workspace.