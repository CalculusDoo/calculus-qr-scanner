import { useMemo } from 'react';
import { Text, TextStyle } from 'react-native';
import { parseAnnouncementBody } from '@/lib/announcement-body';

type Props = { body: string; className?: string; numberOfLines?: number };

export default function AnnouncementBody({ body, className, numberOfLines }: Props) {
  const parsed = useMemo(() => parseAnnouncementBody(body), [body]);
  return (
    <Text className={className} numberOfLines={numberOfLines}>
      {parsed.runs.map((run, index) => {
        const style: TextStyle = {
          fontFamily: run.bold ? 'Rubik-Bold' : 'Rubik-Regular',
          fontStyle: run.italic ? 'italic' : 'normal',
          textDecorationLine: run.underline && run.strike ? 'underline line-through'
            : run.underline ? 'underline' : run.strike ? 'line-through' : 'none',
        };
        return <Text key={index} style={style}>{run.text}</Text>;
      })}
    </Text>
  );
}
