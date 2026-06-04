import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

interface SkillVideoPlayerProps {
  videoUrl: string;
}

function getEmbedUrl(videoUrl: string) {
  if (videoUrl.includes('/shorts/')) {
    const videoId = videoUrl.split('/shorts/')[1]?.split(/[?&,]/)[0];
    return videoId ? `https://www.youtube.com/embed/${videoId}` : videoUrl;
  }

  const watchMatch = videoUrl.match(/[?&]v=([^&]+)/);
  if (watchMatch?.[1]) {
    return `https://www.youtube.com/embed/${watchMatch[1]}`;
  }

  return videoUrl;
}

export function SkillVideoPlayer({ videoUrl }: SkillVideoPlayerProps) {
  return (
    <View style={styles.frame}>
      <WebView
        source={{ uri: getEmbedUrl(videoUrl) }}
        style={styles.webview}
        javaScriptEnabled
        domStorageEnabled
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#000000',
  },
  webview: {
    flex: 1,
    backgroundColor: '#000000',
  },
});
