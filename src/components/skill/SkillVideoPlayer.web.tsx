import { StyleSheet, View } from 'react-native';

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
      <iframe
        src={getEmbedUrl(videoUrl)}
        style={styles.iframe as never}
        title="기술 영상"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
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
  iframe: {
    width: '100%',
    height: '100%',
    borderWidth: 0,
    backgroundColor: '#000000',
  },
});
