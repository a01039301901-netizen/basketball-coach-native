import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import * as Linking from 'expo-linking';
import { Audio } from 'expo-av';
import { useCameraPermissions } from 'expo-camera';
import AppStorage from '../utils/appStorage';
import {
  createEmptyRemoteSnapshot,
  fetchRemoteSession,
  loginRemoteAccount,
  signupRemoteAccount,
  updateRemoteAccountPassword,
  updateRemoteAccountProfile,
  updateRemoteAccountSnapshot,
  type RemoteAccountSnapshot,
} from '../utils/remoteAccount';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Platform } from 'react-native';
import type { WebViewMessageEvent } from 'react-native-webview';
import { SKILLS } from '../constants/content';
import { BALL_BRAND_PRESETS, DEFAULT_BALL_BRAND, DEFAULT_BALL_COLORS, DEFAULT_POSITION } from '../constants/settings';
import { STORAGE_KEYS } from '../constants/storage';
import type {
  AppScreen,
  AuthMode,
  AuthSession,
  AuthUser,
  BallBrandOption,
  BallColorOption,
  BallRecognitionPreview,
  BallRecognitionProfile,
  BallTrainingImageSource,
  CorrectionHomeworkState,
  DiarySkillInsight,
  DailyHomeworkState,
  DribbleAnalysis,
  DribbleLessonView,
  FeedbackMoment,
  FireworkItem,
  HomeworkFeedbackCategory,
  HomeworkProgressItem,
  HomeworkStateRecord,
  HomeworkTestState,
  LessonRecordCriterion,
  LessonRecordEvaluation,
  LessonRecordHighlight,
  LessonRecordLevel,
  LessonMode,
  LessonRecord,
  LessonReviewClip,
  PositionOption,
  ShotGraphDatum,
  SkillVideoOpenEvent,
  ShootAnalysis,
  SkillKey,
  UserAccount,
} from '../types/app';
import { getCalendarCells } from '../utils/calendar';
import {
  BALL_RECOGNITION_PREVIEW_LIMIT,
  deleteBallRecognitionPreviewFiles,
  sanitizeBallRecognitionPreviews,
  sanitizeBallRecognitionProfile,
  writeBallRecognitionPreviewFile,
} from '../utils/ballRecognition';
import { formatDateKey } from '../utils/date';
import { buildDribbleFeedbackText, buildShootFeedbackText } from '../utils/feedback';
import {
  getLessonRecordEntriesWithMigration,
  setLessonRecordEntries,
} from '../utils/lessonRecordStorage';
import { generateLessonRecordThumbnail } from '../utils/lessonRecordThumbnail';
import {
  buildCorrectionHomeworkState,
  buildDailyHomeworkProgress,
  buildStage2UnlockSnapshot,
  createEmptyDailyHomeworkState,
  DAILY_DRIBBLE_TARGET,
  DAILY_SHOOT_TARGET,
  getDailyHomeworkState,
  getHomeworkCompletionMessage,
  getRepresentativeHomeworkFeedbackCategory,
  isDailyBaseHomeworkCompleted,
} from '../utils/homework';

const FEEDBACK_UPDATE_INTERVAL_MS = 1500;
const DRIBBLE_STANCE_HOLD_MS = 3000;
const SHOOT_SUCCESS_CIRCLE_WINDOW_MS = 5000;
const SHOOT_SUCCESS_CIRCLE_WINDOW_SECONDS = SHOOT_SUCCESS_CIRCLE_WINDOW_MS / 1000;
const STORAGE_LOAD_TIMEOUT_MS = 4000;
const STARTUP_RECOVERY_TIMEOUT_MS = 8000;
const DEV_TEST_SHOOT_RECORD_ID = '__dev-test-shoot-bad-no-video-v1';
const DEV_TEST_SHOOT_RECORD_SEED_KEY = 'basketballDevSeedShootBadNoVideoV3';
const DEFAULT_DEBUG_TEXT = '移대찓?쇱? MediaPipe瑜?以鍮꾪븯怨??덉뒿?덈떎.';
const LESSON_RECORD_VIDEO_DIRECTORY_NAME = 'lesson-record-videos';
const LESSON_RECORD_THUMBNAIL_DIRECTORY_NAME = 'lesson-record-thumbnails';
const DEFAULT_LESSON_RECORD_VIDEO_EXTENSION = 'webm';
const DEFAULT_LESSON_RECORD_THUMBNAIL_EXTENSION = 'jpg';
const COUNTDOWN_CUE_BASE64 =
  'UklGRogWAABXQVZFZm10IBAAAAABAAEAIlYAAESsAAACABAAZGF0YWQWAAAAAA8APAB/ANIAKAF1Aa0BxAGyAXEBAAFiAKH/xf7h/QX9Rfyz+2D7Wfum+0j8Pf14/ur/fAEVA5cE5wXqBogHsAdXB3wGJgVlA1EBCv+z/HP6c/jY9sH1SPV89WH28PcW+rb8qP+9AsYFjgjkCp0Mlw26DfwMYgv/CPMFbAKg/sr6K/cA9IDx2u8v75PvBvF588n2yPo4/9MDUAhjDMcPQRKhE8oTshJiEPoMqgiyA2L+DPkI9KrvPOz86Rbpn+mW6+PuV/Ox+J3+vQSxChYQkBTUF6UZ4Bl4GHwVFxGICyQFUf549wvxc+sP5yvk/eKg4xDmL+rA72/21f18BeoMpRM+GVUdoh/5H00esBpVFY4OwgZs/g/2NO5c5/nhZ97n3JjdeOBe5QTsBPTh/A4G+Q4RF9AdxCKYJRYmMCT7H7QZuxGKCLP+0fSE62Xj+tyw2NPWiNfM2nHgVehw8cH7dAbgEFkaRiIgKIUrNiwgKl4lNB4PFX4KJ/++8/zoj98U2AfTwtBw0Q7Vadsi5LLudfquBpwSfR2eJmgtaDFXMh0w1yrSIokYnAzI/9fym+bb20fTbs22ylLLWs+N1lfgHewh+ZIGmhNpH0EphDC+NKw1PjOcLR8lUBrbDYkAL/Oh5qrb+NIYzWbKD8sIzxHWut9n6174zwXjEskewiguMJc0tTV4MwIurCX6GpgOTQHt807nO9xk01jNd8rvyrnOmNUe37PqnPcMBSsSKB5BKNYvbTS8Na8zZi43JqMbVQ8RAq30/efO3NPTm82KytHKbM4g1YTe/+nb9kgEchGEHb4ney9ANMA15DPILsAmShwQENUCbfWt6GPdRNTgzaDKtsohzqvU691N6Rr2hQO4EOAcOSceLxE0wjUWNCgvRifwHMsQmAMt9l/p+t231CjOuMqdytnNONRU3ZzoWvXBAv0POhyyJr8u3zPANUU0hS/LJ5UdhRFcBO72EeqT3izVc87UyojKlM3I07/c7Oea9P0BQg+SGykmXS6qM7w1cTTfL04oOB4+Eh8FsPfF6i3fpNXBzvLKdcpRzVnTLNw959rzOQGFDukaniX4LXIztTWbNDcwzyjZHvYS4gVy+Hnryt8e1hDPE8tlyhHN7dKb25DmHPN1AMgNPxoRJZEtODOrNcI0jDBNKXkfrBOlBjT5L+xn4JrWY883y1jK1MyE0gzb5OVe8rL/Cg2TGYIkKC37Mp415jTfMMopFyBiFGcH9/nm7AfhGNe4z13LTcqZzBzSfto55aDx7v5MDOYY8SO9LLwyjzUINTAxRCq0IBcVKQi6+p7tqOGY1w/QhstFymHMt9Hz2ZDk5PAq/o0LNxheI08sejJ8NSY1fjG8Kk4hyxXrCH37Vu5K4hrYadCyy0HKLMxV0WnZ6OMo8Gb9zQqIF8oi3is1Mmc1QjXJMTIr5yF+FqwJQfwQ7+/in9jG0OHLPsr5y/XQ4thB423vovwMCtcWMyJsK+0xTzVcNREypit/Ii8XbQoE/crvlOMl2STRNsw/ysnLl9Bc2Jzis+7f+0wJJRabIfcqozE1NXI1WDIXLBQj4BctC8j9hvA75K7ZhtFGzEPKnMs80NnX+eH67Rv7ighxFQEhgCpXMRc1hjWbMoYsqCOPGOwLjP5C8eTkONrq0X3MScpxy+PPWNdX4ULtWPrIB70UZiAHKggx9zSXNdwy8yw6JDwZqwxQ///xjuXF2lDStsxSyknLjc/Y1rfgiuyV+QYHCBTIH4wptjDUNKU1GjNdLckk6RlpDRMAvfI55lPbuNLyzF7KJMs5z1vWGODU69P4RAZREykfDiliMK80sDVWM8UtVyWUGicO1wB78+bm49sj0zHNbcoCy+jO4NV73x/rEfiBBZoSiR6PKAswhjS5NY4zKy7kJT4b5A6bATr0lOd23JDTcs1+yuLKms5o1eDea+pP974E4RHnHQ0osi9bNL41xTOOLm4m5hugD18C+vRE6ArdANS2zZLKxspOzvHURt646Y72+gMoEUMdiSdWLy40wTX4M+8u9iaNHFsQIwO69fTooN1x1P3NqcqsygTOfdSv3QbpzfU3A24QnhwDJ/gu/TPBNSk0TS98JzIdFRHnA3r2puk33uXURs7DypTKvc0L1BndVegN9XMCsg/3G3smmC7KM781VzSpLwAo1h3PEaoEPPdZ6tHeXNWSzt/KgMp5zZvThNym5030rwH3Dk8b8SU1LpQzuTWCNAIwgih5HocSbQX99w3rbN/U1eDO/8puyjfNLtPy2/jmjvPrADoOpRpmJc8tWzOxNas0WTACKRkfPxMwBr/4wusI4E/WMc8hy1/K+MzD0mLbS+bQ8icAfA36GdgkZy0gM6Y10TSuMH8puB/1E/MGgvl47KfgzNaFz0bLU8q8zFrS09qf5RLyZP++DE4ZSCT9LOIymDX0NAAx+ylWIKsUtQdF+i/tR+FL19rPbctKyoLM9NFG2vXkVfGg/v8LoBi2I5EsojKINRQ1TzF0KvIgXxV3CAj75+3p4czXM9CXy0PKS8yQ0bzZTOSZ8Nz9QAvxFyMjIixeMnQ1MjWcMesqjCETFjgJy/ug7oziT9iO0MTLP8oXzC7RM9ml493vGP2ACkEXjiKxKxkyXjVNNeYxYCskIsUW+QmP/FrvMePU2OvQ9Ms+yubLz9Cs2P/iI+9U/L8JkBb3IT4r0DFFNWU1LjLTK7sidhe6ClP9FfDX41zZS9EnzEDKt8ty0CjYW+Jp7pH7/gjdFV4hyCqFMSk1ejVzMkQsTyMmGHkLFv7R8H/k5dmt0VzMRcqKyxjQpde44bDtzfo9CCkVwyBQKjgxCzWNNbUysiziI9QYOQza/o3xKOVw2hLSk8xMymHLwM8k1xfh+OwK+nsHdRQnINYp5zDqNJ019TIdLXMkghn3DJ7/S/LS5f3aedLOzFbKOstrz6bWd+BB7Ej5uAa/E4kfWimVMMY0qjUyM4ctAyUuGrUNYgAJ837mjdvj0gvNY8oWyxnPKtbZ34vrhfj2BQgT6R7cKEAwnzS0NW0z7i2QJdgacw4mAcfzLOce3E7TS81zyvXKyM6w1T3f1+rD9zMFUBJIHlso6C92NLs1pDNTLhsmgRsvD+oBh/Ta57HcvNONzYbK18p7zjjVot4j6gL3bwSXEaUd2CeOL0k0wDXZM7UupCYpHOsPrQJG9YroRd0t1NLNm8q7yjDOwtQJ3nDpQfasA90QAR1UJzEvGjTCNQw0FS8sJ88cphBxAwf2O+nc3aDUGs6zyqLK581P1HLdv+iA9egCIxBbHM0m0i7pM8E1PDRyL7EndB1gETUEyPbt6XTeFdVkzs7KjMqizd7T3dwP6MD0JAJnD7QbRCZwLrUzvTVpNM0vNCgXHhkS+ASJ96HqDt+M1bHO7Mp4yl7Nb9NK3GDnAfRgAasOCxu6JQwufjO2NZM0JjC1KLke0RK7BUv4Veuq3wXWAM8My2jKHs0D07jbsuZC85wA7g1hGi0lpi1EM601ujR7MDQpWR+IE34GDfkL7EjggdZSzy/LWsrgzJnSKNsG5oTy2f8wDbUZniQ9LQgzoTXfNM8wsSn4Hz4UQQfQ+cHs5+D+1qfPVctPyqXMMdKa2lvlxvEV/3IMCBkOJNIsyTKSNQE1IDEsKpQg8xQDCJP6ee2H4X7X/s9+y0fKbMzL0Q/aseQJ8VH+swtaGHwjZSyHMoA1ITVuMaQqLyGnFcQIVvsx7iriANhX0KnLQco2zGjRhdkJ5E7wjf3zCqsX5yL1K0MybDU9NboxGyvJIVoWhgkZ/OvuzuKE2LPQ18s/ygPMCNH92GLjku/J/DMK+hZRIoMr/DFUNVc1AzKPK2AiDBdGCt38pe9z4wrZEdEIzD/K0suq0HfYveLY7gb8cglIFrohDyuyMTo1bjVKMgAs9iK8FwYLof1g8Brkktly0TvMQsqly07Q89cZ4h/uQvuxCJUVICGYKmYxHjWCNY4ycCyKI2wYxgtl/hzxwuQc2tXRcsxHynrL9c9x13fhZu1/+u8H4RSFICAqGDH+NJM1zzLdLB0kGhmFDCn/2fFs5anaO9KqzFDKUcuez/LW1+Cv7Lz5LQcsFOgfpSnHMNw0ojUOM0gtrSTHGUMN7f+X8hfmN9uj0ubMW8osy0rPdNY44Pjr+vhrBnYTSR8oKXMwtzSuNUozsC07JXIaAQ6wAFXzxObG2w3TJM1pygnL+M751ZrfQ+s4+KgFvhKpHqgoHTCPNLc1gzMWLsglHBu+DnQBFPRx51jcetNlzXrK6cqpzoDV/96P6nb35QQGEgceJyjEL2Q0vTW6M3ouUibFG3oPOALT9CDo7Nzp06jNjsrLyl3OCdVl3tvptPYhBE0RZB2kJ2kvNzTBNe4z3C7bJmwcNhD8ApP10eiB3VrU882kyrHKE86U1M3dKen09V4DkxC/HB4nCy8HNMI1HzQ6L2EnER3wEL8DVPaC6RneztQ3zr7KmcrLzSLUNt146DP1mgLYDxgclyarLtQzvzVONJcv5ie2HaoRgwQV9zXqst5E1YLO2sqEyobNsdOi3Mnnc/TWARwPcBsNJkkunzO7NXo08S9oKFgeYhJGBdf36epM37zV0M74ynHKRM1D0w/cGue08xIBYA7HGoIl5C1nM7M1ozRIMOgo+R4aEwkGmfie6+nfNtYhzxrLYsoFzdjSfttt5vbyTgCiDRwa9CR8LSwzqDXJNJ0wZimZH9ETzAZb+VTsh+Cz1nTPPstVysjMb9Lv2sHlOPKL/+QMcBllJBMt7zKbNe008DDiKTYghxSOBx76Cu0n4THXyc9ly0vKjswI0mLaF+V78cf+JgzDGNQjpyyvMos1DjU/MVwq0yA7FVAI4frC7cjhstch0I/LRMpWzKPR19lu5L7wA/5mCxQYQSM4LGwyeDUsNY0x1CptIe8VEgmk+3vua+I12HvQu8tAyiHMQdFO2cbjA/A//aYKZBesIsgrJzJjNUg12DFJKwYioRbTCWj8Ne8Q47rY2NDqyz7K78vi0MfYIONI73v85gmzFhUiVSvfMUo1YDUgMrwrnSJTF5MKK/3w77bjQNk40RzMQMrAy4XQQth84o7uuPslCQEWfCHgKpQxLzV2NWUyLSwyIwMYUwvv/avwXeTJ2ZrRUcxEypPLKtC/19jh1e30+mQITRXiIGgqRzERNYk1qDKcLMUjshgTDLP+aPEG5VTa/tGIzEvKacvSzz7XN+Ed7TH6ogeZFEYg7yn4MPE0mjXoMggtViRfGdEMd/8l8rDl4dpk0sLMVMpCy3zPv9aX4GbsbvnfBuMTqR9zKaYwzTSnNSYzci3mJAsajw06AOPyXOZw283S/8xhyh3LKc9D1vnfsOus+B0GLRMJH/UoUTCnNLI1YTPZLXQlthpNDv4AofMJ5wHcOdM+zXDK/MrYzsjVXN/76ur3WgV1EmgedSj6L340ujWZMz8u/yVgGwkPwgFg9Lfnk9ym04DNgsrcyorOUNXB3kfqKPeXBLwRxh3zJ6AvUjS/Nc8zoS6JJggcxQ+GAiD1Z+gn3RbUxM2XysDKP87a1CjelOln9tMDAxEiHW8nRC8kNME1AjQCLxEnrhyAEEoD4PUY6b7diNQLzq7Kp8r2zWbUkN3i6Kf1DwNIEHwc6CblLvMzwTUyNGAvlidTHToRDgSh9srpVt791FXOyMqQyq/N9NP73DLo5vRMAo0P1RtgJoQuvzO+NWA0uy8aKPcd9BHRBGL3ferv3nTVoc7mynzKbM2F02fcg+cn9IgB0Q4tG9YlIS6JM7g1izQUMJwomR6sEpQFJPgx64vf7dXwzgXLa8orzRjT1dvV5mjzxAAUDoMaSSW7LVAzrzWzNGswGyk5H2MTVwbm+ObrKOBo1kLPKMtdyuzMrtJF2yjmqvIAAFENxBmRJAwtsTInNUk0KDAHKV0fxBP5Bsn5Bu184eTX1NC8zNzLPc650/TbaeZv8kT/GQwkGKMi8CqHMBIzazKdLuonvR6tE2sHvvpu7kHj6dn50uDO2835zxXV29zM5kjylv7vCpAWvyDZKGAu/DCHMAstwSYRHocTzwek+8nv++Tm2xvVA9Hdz7vRetbN3T3nMPL3/dMJCRXkHskmOyzlLp8ucCuNJVcdUxMjCHz8F/Gq5tzdN9ck0+LRg9Pp18zevOco8mf9xQiNExMdvyQZKs0ssizNKU4kkBwQE2kIRv1Y8k7oyd9P2UXV6tNR1WLZ199J6C7y5vzFBx4STBu8IvontCrBKiIoBCO8G78SnwgB/ovz5+mu4WHbZNf01SbX49ru4OToQ/J0/NMGuxCOGcAg3yWbKMwocCaxIdsaYBLHCK3+sfR164rjbt2B2QDYANlt3BDijOlm8hH87wVlD9sXyx7HI4Mm0ya3JFMg7hnyEeAISv/J9fbsXeV1353bDdrf2gDePuNB6pjyvfsaBRwOMxbeHLQhaiTYJPgi6x71GHYR6QjZ/9T2bO4n53fhtd0c3MPcm9925ATr2fJ3+1ME4AyVFPkapR9TItkiMSF5He8X7BDkCFcA0PfW7+focuPL3yzeq94+4brl1Oso80H7mgOxCwMTGxmbHT0g1yBlH/4b3RZVENAIyAC/+DPxnepm5d7hPOCY4OniCOew7IbzGfvxAo8KexFHF5YbKB7UHpIdehrAFbAPrggqAaD5hPJK7FPn7eNN4onim+Rg6Jrt8fMB+1UCewn/D3oVlxkUHM4cuxvuGJcU/Q58CH4BcvrJ8+ztOen55V3kfeRV5sPpkO5r9Pf6yQF0CI4OtxOdFwMaxxrdGVgXYhM9Dj0IwgE2+wH1hO8Y6wHobuZ15hXoMOuS7/P0/PpLAXsHKg39EagV9Be+GPsXuhUjEnAN7gf3Aez7LPYS8e/sBOp96HDo3Omm7KDwifUQ+9sAkAbRC0wQuhPoFbQWFBYVFNkQlQyRBx4ClPxJ95Tyvu4D7Izqbuqp6ybuu/Et9jP7ewCyBYQKpA7TEd8TqRQpFGcShA+uCyYHNgIt/Vr4DPSF8P3tmexu7Hztr+/h8t72ZPspAOIEQwkHDfIP2RGeEjkSshAkDroKrQY+Arf9Xvl49UTy8u+l7nHuVe9A8RP0nfek++j/IQQPCHMLGA7WD5MQRhD2DroMugklBjgCM/5U+tn2+fPh8a/wdfAz8dzyUPVp+PP7tP9uA+gG6glGDNgNiA5PDjINRwutCJAFJAKg/jz7Lvim9crzt/J68hbzfvSZ9kP5UPyO/8kCzQVrCHsK3Qt+DFUMaAvJCZMH7QQAAv/+F/x4+Un3rvW89IH0/vQp9uz3Kfq7/Hj/MgK/BPcGuAjnCXQKWAqYCUIIbgY7BM4BT//k/LX64/iL9772ifbr9tz3Svkd+zX9cP+pAb8DjgX9BvYHbAhZCMIHsgY9BXwDjQGQ/6P95vtz+mH5vfiR+Nz4lvmz+h38vf14/zABywIxBEsFCgZlBlcG5QUZBQAEsAI9AcL/VP4L/fr7MPu5+pn60PpY+yb8Kv1T/o7/xADlAd4CoQMjBF8EVAQEBHcDuALWAd8A5v/3/iP+dv35/LH8ovzJ/CH9o/1E/vj+s/9nAAwBlwEAAkICXAJPAh0CzAFlAe8AcwD6/4z/L//o/rn+pf6q/sT+8f4p/2n/qv/m/xkAQQBcAGgAZwBcAEgAMQAaAA==';

type DribbleLessonPhase = 'stance_setup' | 'countdown' | 'await_dribble' | 'active' | 'cooldown';
type CameraStopMode = 'review' | 'disconnect' | null;
type FrontDribbleCriterionNumber = 1 | 2 | 3 | 4;

interface FrontDribbleWeakPoint {
  criterionNumber: FrontDribbleCriterionNumber;
  feedbackText: string;
  count: number;
}

interface TimedShootAnalysis {
  atMs: number;
  analysis: ShootAnalysis;
}

interface TimedDribbleAnalysis {
  atMs: number;
  analysis: DribbleAnalysis;
}

interface AuthFormValues {
  nickname: string;
  password: string;
  keepSignedIn: boolean;
}

interface AuthActionResult {
  success: boolean;
  message: string;
}

interface ProfileUpdateValues {
  nickname: string;
}

interface PasswordChangeValues {
  currentPassword: string;
  nextPassword: string;
  nextPasswordConfirm: string;
}

interface TransferCodeResult {
  success: boolean;
  message: string;
  code?: string;
}

interface AccountTransferPayload {
  version: 1;
  exportedAt: string;
  account: UserAccount;
  data: {
    attendance: Record<string, string>;
    lessonRecords: LessonRecord[];
    dribbleCounts: Record<string, number>;
    shotAttempts: Record<string, number>;
    shotSuccess: Record<string, number>;
    ballColors: BallColorOption[];
    ballBrand: BallBrandOption;
    ballRecognitionProfile: BallRecognitionProfile | null;
    position: PositionOption;
    homework: HomeworkStateRecord;
  };
}

interface PendingBallRecognitionPreview extends BallRecognitionPreview {
  dataUrl: string;
}

interface BallRecognitionCalibrationJob {
  id: string;
  previousPreviews: BallRecognitionPreview[];
  previews: BallRecognitionPreview[];
  pendingPreviews: PendingBallRecognitionPreview[];
}

const DEFAULT_DRIBBLE_FEEDBACK =
  '?쒕━釉??쇰뱶諛?n1. ?쒖꽑, 怨??믪씠, ?곸껜 ?먯꽭瑜?遺꾩꽍?섎뒗 以묒엯?덈떎.\n2. 紐??꾩껜? 怨듭씠 ?붾㈃ ?덉뿉 蹂댁씠?꾨줉 留욎떠 二쇱꽭??\n3. 遺꾩꽍???덉젙?섎㈃ 湲곗???留욌뒗 ?쇰뱶諛깆씠 諛붾줈 ?섑??⑸땲??';

const DEFAULT_SHOOT_FEEDBACK =
  '???쇰뱶諛?n1. ??媛곷룄, ????대컢, ?섏껜 媛곷룄瑜?遺꾩꽍?섎뒗 以묒엯?덈떎.\n2. ?닿묠遺??諛쒕걹源뚯? 紐??꾩껜媛 ?붾㈃ ?덉뿉 蹂댁씠?꾨줉 留욎떠 二쇱꽭??\n3. 遺꾩꽍???덉젙?섎㈃ 湲곗???留욌뒗 ?쇰뱶諛깆씠 諛붾줈 ?섑??⑸땲??';

function createFireworks(): FireworkItem[] {
  const emojis = ['✨', '🎉', '🔥'];

  return Array.from({ length: 10 }, (_, index) => ({
    id: `${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`,
    emoji: emojis[Math.floor(Math.random() * emojis.length)],
    left: `${12 + Math.random() * 74}%` as `${number}%`,
    top: `${10 + Math.random() * 42}%` as `${number}%`,
  }));
}

function normalizeNickname(nickname: string) {
  return nickname.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

function buildUniqueNickname(baseNickname: string, usedNicknames: Set<string>, fallbackSeed: string) {
  const trimmedBase = baseNickname.trim().replace(/\s+/g, ' ');
  const fallbackBase = trimmedBase || `user-${fallbackSeed.slice(-4)}`;
  let candidate = fallbackBase;
  let suffix = 1;

  while (usedNicknames.has(normalizeNickname(candidate))) {
    suffix += 1;
    candidate = `${fallbackBase}-${suffix}`;
  }

  usedNicknames.add(normalizeNickname(candidate));
  return candidate;
}

function buildAccountStorageKey(baseKey: string, userId: string) {
  return `${baseKey}:${userId}`;
}

function sanitizeAccountNickname(nickname: string) {
  return nickname.trim().replace(/\s+/g, ' ');
}

function buildCachedAccount(account: UserAccount): UserAccount {
  return {
    id: account.id,
    nickname: sanitizeAccountNickname(account.nickname),
    createdAt: account.createdAt,
  };
}

function mergeCachedAccounts(accountList: UserAccount[], nextAccount: UserAccount) {
  const cachedAccount = buildCachedAccount(nextAccount);
  const normalizedNickname = normalizeNickname(cachedAccount.nickname);

  return [
    ...accountList.filter((account) => {
      if (account.id === cachedAccount.id) {
        return false;
      }

      return normalizeNickname(account.nickname) !== normalizedNickname;
    }),
    cachedAccount,
  ];
}

function getAccountStorageKeys(userId: string) {
  return {
    attendance: buildAccountStorageKey(STORAGE_KEYS.attendance, userId),
    homework: buildAccountStorageKey(STORAGE_KEYS.homework, userId),
    lessonRecords: buildAccountStorageKey(STORAGE_KEYS.lessonRecords, userId),
    lessonRecordVideos: buildAccountStorageKey(STORAGE_KEYS.lessonRecordVideos, userId),
    lessonRecordThumbnails: buildAccountStorageKey(STORAGE_KEYS.lessonRecordThumbnails, userId),
    dribbleCounts: buildAccountStorageKey(STORAGE_KEYS.dribbleCounts, userId),
    shotAttempts: buildAccountStorageKey(STORAGE_KEYS.shotAttempts, userId),
    shotSuccess: buildAccountStorageKey(STORAGE_KEYS.shotSuccess, userId),
    ballColors: buildAccountStorageKey(STORAGE_KEYS.ballColors, userId),
    ballBrand: buildAccountStorageKey(STORAGE_KEYS.ballBrand, userId),
    ballRecognitionProfile: buildAccountStorageKey(STORAGE_KEYS.ballRecognitionProfile, userId),
    ballRecognitionPreviews: buildAccountStorageKey(STORAGE_KEYS.ballRecognitionPreviews, userId),
    position: buildAccountStorageKey(STORAGE_KEYS.position, userId),
  } as const;
}

function buildLessonRecordVideoDirectory(userId: string) {
  if (Platform.OS === 'web' || !FileSystem.documentDirectory) {
    return null;
  }

  const safeUserId = userId.replace(/[^a-z0-9_-]/gi, '_') || 'local';
  return `${FileSystem.documentDirectory}${LESSON_RECORD_VIDEO_DIRECTORY_NAME}/${safeUserId}/`;
}

function buildLessonRecordThumbnailDirectory(userId: string) {
  if (Platform.OS === 'web' || !FileSystem.documentDirectory) {
    return null;
  }

  const safeUserId = userId.replace(/[^a-z0-9_-]/gi, '_') || 'local';
  return `${FileSystem.documentDirectory}${LESSON_RECORD_THUMBNAIL_DIRECTORY_NAME}/${safeUserId}/`;
}

function sanitizeLessonRecordVideoFileToken(value: string) {
  return value.replace(/[^a-z0-9_-]/gi, '_') || 'record';
}

function parseLessonRecordVideoDataUrl(videoUri: string) {
  if (!videoUri.startsWith('data:')) {
    return null;
  }

  const separatorIndex = videoUri.indexOf(',');

  if (separatorIndex <= 5) {
    return null;
  }

  const metadata = videoUri.slice(5, separatorIndex);
  const [mimeType] = metadata.split(';');
  const normalizedMimeType = mimeType?.trim().toLowerCase() || '';

  if (!metadata.includes(';base64') || !normalizedMimeType.startsWith('video/')) {
    return null;
  }

  const base64 = videoUri.slice(separatorIndex + 1);

  if (!base64) {
    return null;
  }

  return {
    mimeType: normalizedMimeType,
    base64,
  };
}

function getLessonRecordVideoExtension(videoUri: string, mimeType?: string) {
  if (mimeType === 'video/mp4') {
    return 'mp4';
  }

  if (mimeType === 'video/quicktime') {
    return 'mov';
  }

  if (mimeType === 'video/x-m4v') {
    return 'm4v';
  }

  if (mimeType === 'video/webm') {
    return 'webm';
  }

  const extensionMatch = /\.([a-z0-9]+)(?:[?#].*)?$/i.exec(videoUri);
  return extensionMatch?.[1]?.toLowerCase() || DEFAULT_LESSON_RECORD_VIDEO_EXTENSION;
}

function buildManagedLessonRecordVideoUri(directory: string, recordId: string, extension: string) {
  const safeRecordId = sanitizeLessonRecordVideoFileToken(recordId);
  return `${directory}${safeRecordId}.${extension}`;
}

function buildManagedLessonRecordThumbnailUri(directory: string, recordId: string) {
  const safeRecordId = sanitizeLessonRecordVideoFileToken(recordId);
  return `${directory}${safeRecordId}.${DEFAULT_LESSON_RECORD_THUMBNAIL_EXTENSION}`;
}

function toAuthUser(account: UserAccount): AuthUser {
  return {
    id: account.id,
    nickname: account.nickname,
  };
}

function parseStoredJson<T>(value: string | null, fallback: T): T {
  if (typeof value !== 'string' || !value.trim()) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function sanitizeStoredSession(value: unknown): AuthSession | null {
  if (!isRecordObject(value) || typeof value.userId !== 'string') {
    return null;
  }

  return {
    userId: value.userId,
    remoteToken: typeof value.remoteToken === 'string' ? value.remoteToken : null,
  };
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallbackValue: T): Promise<T> {
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((resolve) => {
        timeoutHandle = setTimeout(() => resolve(fallbackValue), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}

function isRecordObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sanitizeStoredAccounts(value: unknown): UserAccount[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const usedNicknames = new Set<string>();

  return value
    .map<UserAccount | null>((entry, index) => {
      if (!isRecordObject(entry)) {
        return null;
      }

      if (
        typeof entry.id !== 'string' ||
        typeof entry.createdAt !== 'string'
      ) {
        return null;
      }

      const fallbackSeed = entry.id || String(index + 1);
      const rawNickname =
        typeof entry.nickname === 'string'
          ? entry.nickname
          : typeof entry.name === 'string'
            ? entry.name
            : `user-${fallbackSeed.slice(-4)}`;
      const nickname = buildUniqueNickname(rawNickname, usedNicknames, fallbackSeed);

      return {
        id: entry.id,
        nickname,
        password: typeof entry.password === 'string' ? entry.password : undefined,
        createdAt: entry.createdAt,
      };
    })
    .filter((account): account is UserAccount => account !== null);
}

function isBallBrandOption(value: unknown): value is BallBrandOption {
  return value === 'wilson' || value === 'spalding' || value === 'molten';
}

function isPositionOption(value: unknown): value is PositionOption {
  return value === 'none' || value === 'defense' || value === 'offense';
}

function isBallColorOption(value: unknown): value is BallColorOption {
  return value === 'orange' || value === 'brown' || value === 'yellow' || value === 'white' || value === 'black' || value === 'gray' || value === 'red';
}

function buildBallRecognitionPreviewId() {
  return `ball-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildBallRecognitionMimeType(asset: ImagePicker.ImagePickerAsset) {
  if (typeof asset.mimeType === 'string' && asset.mimeType) {
    return asset.mimeType;
  }

  return buildBallRecognitionMimeTypeFromUri(asset.uri);
}

function buildBallRecognitionMimeTypeFromUri(uri: string) {
  const normalizedUri = uri.toLowerCase();

  if (normalizedUri.endsWith('.png')) {
    return 'image/png';
  }

  if (normalizedUri.endsWith('.webp')) {
    return 'image/webp';
  }

  return 'image/jpeg';
}

function normalizeBallRecognitionMimeType(mimeType: string | null | undefined, fallbackUri: string) {
  const normalizedMimeType = typeof mimeType === 'string' ? mimeType.split(';')[0]?.trim().toLowerCase() : '';

  if (normalizedMimeType?.startsWith('image/')) {
    return normalizedMimeType;
  }

  return buildBallRecognitionMimeTypeFromUri(fallbackUri);
}

function buildBallRecognitionFileNameFromUrl(url: string) {
  try {
    const parsedUrl = new URL(url);
    const fileName = parsedUrl.pathname.split('/').pop()?.trim();
    return fileName || `ball-reference-${Date.now()}.jpg`;
  } catch {
    return `ball-reference-${Date.now()}.jpg`;
  }
}

async function buildPendingBallRecognitionPreviewFromBase64(
  userId: string,
  {
    base64,
    fileName,
    mimeType,
    source,
  }: {
    base64: string;
    fileName?: string | null;
    mimeType: string;
    source: BallTrainingImageSource;
  }
): Promise<PendingBallRecognitionPreview> {
  const id = buildBallRecognitionPreviewId();
  const uri = await writeBallRecognitionPreviewFile({
    userId,
    previewId: id,
    base64,
    fileName,
    mimeType,
  });

  return {
    id,
    uri,
    source,
    createdAt: new Date().toISOString(),
    dataUrl: `data:${mimeType};base64,${base64}`,
  };
}

async function buildPendingBallRecognitionPreview(
  userId: string,
  asset: ImagePicker.ImagePickerAsset,
  source: BallTrainingImageSource
): Promise<PendingBallRecognitionPreview> {
  const base64 =
    typeof asset.base64 === 'string' && asset.base64
      ? asset.base64
      : await FileSystem.readAsStringAsync(asset.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
  const mimeType = buildBallRecognitionMimeType(asset);
  return buildPendingBallRecognitionPreviewFromBase64(userId, {
    base64,
    mimeType,
    fileName: asset.fileName,
    source,
  });
}

async function readBlobAsDataUrl(blob: Blob): Promise<string> {
  if (typeof FileReader === 'undefined') {
    throw new Error('file_reader_unavailable');
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onloadend = () => {
      if (typeof reader.result === 'string' && reader.result) {
        resolve(reader.result);
        return;
      }

      reject(new Error('image_data_url_unavailable'));
    };

    reader.onerror = () => {
      reject(new Error('image_data_url_read_failed'));
    };

    reader.readAsDataURL(blob);
  });
}

async function downloadBallRecognitionImageFromUrl(url: string) {
  if (Platform.OS !== 'web' && FileSystem.cacheDirectory) {
    const tempUri = `${FileSystem.cacheDirectory}${buildBallRecognitionPreviewId()}`;

    try {
      const result = await FileSystem.downloadAsync(url, tempUri);
      const mimeType = normalizeBallRecognitionMimeType(
        result.headers?.['Content-Type'] ?? result.headers?.['content-type'],
        result.uri
      );

      if (!mimeType.startsWith('image/')) {
        throw new Error('remote_image_type_invalid');
      }

      const base64 = await FileSystem.readAsStringAsync(result.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      return {
        base64,
        mimeType,
        fileName: buildBallRecognitionFileNameFromUrl(url),
      };
    } finally {
      await FileSystem.deleteAsync(tempUri, { idempotent: true }).catch(() => {
        // Ignore temporary file cleanup failures.
      });
    }
  }

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`remote_image_fetch_failed:${response.status}`);
  }

  const blob = await response.blob();
  const mimeType = normalizeBallRecognitionMimeType(blob.type, url);

  if (!mimeType.startsWith('image/')) {
    throw new Error('remote_image_type_invalid');
  }

  const dataUrl = await readBlobAsDataUrl(blob);
  const base64 = dataUrl.split(',')[1] ?? '';

  if (!base64) {
    throw new Error('remote_image_base64_missing');
  }

  return {
    base64,
    mimeType,
    fileName: buildBallRecognitionFileNameFromUrl(url),
  };
}

async function buildPendingBallRecognitionPreviewFromUrl(
  userId: string,
  url: string
): Promise<PendingBallRecognitionPreview> {
  const downloadedImage = await downloadBallRecognitionImageFromUrl(url);

  return buildPendingBallRecognitionPreviewFromBase64(userId, {
    base64: downloadedImage.base64,
    mimeType: downloadedImage.mimeType,
    fileName: downloadedImage.fileName,
    source: 'url',
  });
}

function parseBallRecognitionImageUrls(rawValue: string) {
  const uniqueUrls = new Set<string>();

  for (const entry of rawValue.split(/[\n,]+/)) {
    const trimmedEntry = entry.trim();

    if (!trimmedEntry) {
      continue;
    }

    try {
      const parsedUrl = new URL(trimmedEntry);

      if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
        continue;
      }

      uniqueUrls.add(parsedUrl.toString());
    } catch {
      // Ignore invalid URLs and only keep well-formed image links.
    }
  }

  return Array.from(uniqueUrls);
}

async function hydrateStoredBallRecognitionPreview(preview: BallRecognitionPreview): Promise<PendingBallRecognitionPreview | null> {
  try {
    const base64 = await FileSystem.readAsStringAsync(preview.uri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    return {
      ...preview,
      dataUrl: `data:${buildBallRecognitionMimeTypeFromUri(preview.uri)};base64,${base64}`,
    };
  } catch {
    return null;
  }
}

function sortBallRecognitionPreviewsByCreatedAt<T extends { createdAt: string }>(previews: T[]) {
  return [...previews].sort(
    (left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
  );
}

function stripPendingBallRecognitionPreview(preview: PendingBallRecognitionPreview): BallRecognitionPreview {
  return {
    id: preview.id,
    uri: preview.uri,
    source: preview.source,
    createdAt: preview.createdAt,
  };
}

function isSkillKey(value: unknown): value is SkillKey {
  return value === 'shoot' || value === 'crossover' || value === 'layup' || value === 'stepback' || value === 'spin' || value === 'defense';
}

function isHomeworkFeedbackCategory(value: unknown): value is HomeworkFeedbackCategory {
  return (
    value === 'dribble_balance' ||
    value === 'torso_posture' ||
    value === 'shoot_arm_angle' ||
    value === 'shoot_release_timing' ||
    value === 'leg_angle'
  );
}

function sanitizeStringRecord(value: unknown): Record<string, string> {
  if (!isRecordObject(value)) {
    return {};
  }

  const next: Record<string, string> = {};

  for (const [key, entryValue] of Object.entries(value)) {
    if (typeof entryValue === 'string') {
      next[key] = entryValue;
    }
  }

  return next;
}

function sanitizeNumberRecord(value: unknown): Record<string, number> {
  if (!isRecordObject(value)) {
    return {};
  }

  const next: Record<string, number> = {};

  for (const [key, entryValue] of Object.entries(value)) {
    if (typeof entryValue === 'number' && Number.isFinite(entryValue)) {
      next[key] = entryValue;
    }
  }

  return next;
}

function sanitizeSkillVideoEvents(value: unknown): SkillVideoOpenEvent[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (!isRecordObject(entry) || !isSkillKey(entry.skillKey) || typeof entry.openedAt !== 'string') {
        return null;
      }

      return {
        skillKey: entry.skillKey,
        openedAt: entry.openedAt,
      } satisfies SkillVideoOpenEvent;
    })
    .filter((event): event is SkillVideoOpenEvent => Boolean(event));
}

function sanitizeDailyHomeworkState(value: unknown): DailyHomeworkState {
  if (!isRecordObject(value)) {
    return createEmptyDailyHomeworkState();
  }

  const baseState = createEmptyDailyHomeworkState();
  const stage2Unlock = isRecordObject(value.stage2Unlock)
    && typeof value.stage2Unlock.unlockedAt === 'string'
    && isPositionOption(value.stage2Unlock.position)
    && typeof value.stage2Unlock.dribbleCount === 'number'
    && Number.isFinite(value.stage2Unlock.dribbleCount)
    && typeof value.stage2Unlock.shootAttemptCount === 'number'
    && Number.isFinite(value.stage2Unlock.shootAttemptCount)
    && typeof value.stage2Unlock.shotSuccessCount === 'number'
    && Number.isFinite(value.stage2Unlock.shotSuccessCount)
    && typeof value.stage2Unlock.lessonCount === 'number'
    && Number.isFinite(value.stage2Unlock.lessonCount)
      ? {
          unlockedAt: value.stage2Unlock.unlockedAt,
          position: value.stage2Unlock.position,
          dribbleCount: Math.max(0, value.stage2Unlock.dribbleCount),
          shootAttemptCount: Math.max(0, value.stage2Unlock.shootAttemptCount),
          shotSuccessCount: Math.max(0, value.stage2Unlock.shotSuccessCount),
          lessonCount: Math.max(0, value.stage2Unlock.lessonCount),
        }
      : null;
  const handTotals = isRecordObject(value.handDribbleTotals)
    ? {
        left:
          typeof value.handDribbleTotals.left === 'number' && Number.isFinite(value.handDribbleTotals.left)
            ? Math.max(0, value.handDribbleTotals.left)
            : 0,
        right:
          typeof value.handDribbleTotals.right === 'number' && Number.isFinite(value.handDribbleTotals.right)
            ? Math.max(0, value.handDribbleTotals.right)
            : 0,
      }
    : baseState.handDribbleTotals;
  const correctionTask = isRecordObject(value.correctionTask)
    && (value.correctionTask.direction === 'left' || value.correctionTask.direction === 'right')
    && typeof value.correctionTask.baselineCount === 'number'
    && Number.isFinite(value.correctionTask.baselineCount)
    && typeof value.correctionTask.createdAt === 'string'
      ? {
          direction: value.correctionTask.direction === 'left' ? 'left' : 'right',
          baselineCount: Math.max(0, value.correctionTask.baselineCount),
          createdAt: value.correctionTask.createdAt,
        } satisfies CorrectionHomeworkState
      : null;

  return {
    stage2Unlock,
    skillVideoEvents: sanitizeSkillVideoEvents(value.skillVideoEvents),
    handDribbleTotals: handTotals,
    correctionTask,
  };
}

function sanitizeHomeworkStateRecord(value: unknown): HomeworkStateRecord {
  if (!isRecordObject(value)) {
    return {};
  }

  const next: HomeworkStateRecord = {};

  for (const [dateKey, entryValue] of Object.entries(value)) {
    next[dateKey] = sanitizeDailyHomeworkState(entryValue);
  }

  return next;
}

function sanitizeLessonRecords(value: unknown): LessonRecord[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (!isRecordObject(entry)) {
        return null;
      }

      const id = typeof entry.id === 'string' ? entry.id : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const dateKey = typeof entry.dateKey === 'string' ? entry.dateKey : formatDateKey(new Date());
      const mode = entry.mode === 'shoot' ? 'shoot' : 'dribble';
      const shotOutcome =
        entry.shotOutcome === 'success' ? 'success' : entry.shotOutcome === 'failure' ? 'failure' : undefined;
      const feedback = typeof entry.feedback === 'string' ? entry.feedback : '';
      const videoUri = typeof entry.videoUri === 'string' ? entry.videoUri : '';
      const thumbnailUri = typeof entry.thumbnailUri === 'string' ? entry.thumbnailUri : '';
      const createdAt = typeof entry.createdAt === 'string' ? entry.createdAt : new Date().toISOString();
      const reviewFeedback = typeof entry.reviewFeedback === 'string' ? entry.reviewFeedback : undefined;
      const reviewStartAtMs =
        typeof entry.reviewStartAtMs === 'number' && Number.isFinite(entry.reviewStartAtMs) ? entry.reviewStartAtMs : undefined;
      const reviewDurationMs =
        typeof entry.reviewDurationMs === 'number' && Number.isFinite(entry.reviewDurationMs) ? entry.reviewDurationMs : undefined;
      const dribbleView = entry.dribbleView === 'side' ? 'side' : entry.dribbleView === 'front' ? 'front' : undefined;
      const leftHandDribbleCount =
        typeof entry.leftHandDribbleCount === 'number' && Number.isFinite(entry.leftHandDribbleCount)
          ? Math.max(0, entry.leftHandDribbleCount)
          : undefined;
      const rightHandDribbleCount =
        typeof entry.rightHandDribbleCount === 'number' && Number.isFinite(entry.rightHandDribbleCount)
          ? Math.max(0, entry.rightHandDribbleCount)
          : undefined;
      const representativeFeedbackCategory = isHomeworkFeedbackCategory(entry.representativeFeedbackCategory)
        ? entry.representativeFeedbackCategory
        : undefined;
      const evaluation = normalizeLessonRecordEvaluation(entry.evaluation);

      const nextRecord: LessonRecord = normalizeLessonRecord({
        id,
        dateKey,
        mode,
        shotOutcome,
        feedback,
        feedbackTimeline: Array.isArray(entry.feedbackTimeline)
          ? (entry.feedbackTimeline as FeedbackMoment[] | string[])
          : undefined,
        videoUri,
        thumbnailUri,
        createdAt,
        reviewFeedback,
        reviewStartAtMs,
        reviewDurationMs,
        dribbleView,
        leftHandDribbleCount,
        rightHandDribbleCount,
        representativeFeedbackCategory,
        evaluation,
      });

      return nextRecord;
    })
    .filter((record): record is LessonRecord => Boolean(record));
}

function sanitizeTransferPayload(value: unknown): AccountTransferPayload | null {
  if (!isRecordObject(value) || value.version !== 1) {
    return null;
  }

  const accountValue = value.account;
  const dataValue = value.data;

  if (!isRecordObject(accountValue) || !isRecordObject(dataValue)) {
    return null;
  }

  if (
    typeof accountValue.id !== 'string' ||
    (typeof accountValue.nickname !== 'string' && typeof accountValue.name !== 'string') ||
    (typeof accountValue.password !== 'string' && typeof accountValue.password !== 'undefined') ||
    typeof accountValue.createdAt !== 'string'
  ) {
    return null;
  }

  const ballBrand = isBallBrandOption(dataValue.ballBrand) ? dataValue.ballBrand : DEFAULT_BALL_BRAND;
  const ballColors = Array.isArray(dataValue.ballColors)
    ? dataValue.ballColors.filter(isBallColorOption)
    : DEFAULT_BALL_COLORS;
  const ballRecognitionProfile = sanitizeBallRecognitionProfile(dataValue.ballRecognitionProfile);
  const position = isPositionOption(dataValue.position) ? dataValue.position : DEFAULT_POSITION;

  return {
    version: 1,
    exportedAt: typeof value.exportedAt === 'string' ? value.exportedAt : new Date().toISOString(),
    account: {
      id: accountValue.id,
      nickname:
        typeof accountValue.nickname === 'string'
          ? accountValue.nickname
          : typeof accountValue.name === 'string'
            ? accountValue.name
            : `user-${accountValue.id.slice(-4)}`,
      password: typeof accountValue.password === 'string' ? accountValue.password : undefined,
      createdAt: accountValue.createdAt,
    },
    data: {
      attendance: sanitizeStringRecord(dataValue.attendance),
      lessonRecords: sanitizeLessonRecords(dataValue.lessonRecords),
      dribbleCounts: sanitizeNumberRecord(dataValue.dribbleCounts),
      shotAttempts: sanitizeNumberRecord(dataValue.shotAttempts),
      shotSuccess: sanitizeNumberRecord(dataValue.shotSuccess),
      ballColors: ballColors.length > 0 ? ballColors : DEFAULT_BALL_COLORS,
      ballBrand,
      ballRecognitionProfile,
      position,
      homework: sanitizeHomeworkStateRecord(dataValue.homework),
    },
  };
}

function parseDateKeyToDate(dateKey: string) {
  const [yearText, monthText, dayText] = dateKey.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return new Date();
  }

  return new Date(year, month - 1, day);
}

function parseTimelineTimestamp(value: string) {
  const match = value.match(/^\[(\d{2}):(\d{2})\]\s*(.*)$/);

  if (!match) {
    return null;
  }

  const minutes = Number(match[1]);
  const seconds = Number(match[2]);
  const text = match[3]?.trim() ?? '';

  return {
    atMs: (minutes * 60 + seconds) * 1000,
    text,
  };
}

function normalizeFeedbackTimeline(
  timeline: FeedbackMoment[] | string[] | undefined,
  fallbackFeedback: string
): FeedbackMoment[] {
  if (!Array.isArray(timeline) || timeline.length === 0) {
    return fallbackFeedback ? [{ atMs: 0, text: fallbackFeedback }] : [];
  }

  const normalized = timeline
    .map((entry, index) => {
      if (typeof entry === 'string') {
        const parsed = parseTimelineTimestamp(entry);

        if (parsed) {
          return parsed;
        }

        return {
          atMs: index * 1000,
          text: entry.trim(),
        };
      }

      if (!entry || typeof entry.text !== 'string') {
        return null;
      }

      return {
        atMs: typeof entry.atMs === 'number' && Number.isFinite(entry.atMs) ? Math.max(0, entry.atMs) : index * 1000,
        text: entry.text.trim(),
      };
    })
    .filter((entry): entry is FeedbackMoment => Boolean(entry && entry.text));

  if (normalized.length > 0) {
    return normalized;
  }

  return fallbackFeedback ? [{ atMs: 0, text: fallbackFeedback }] : [];
}

function normalizeLessonRecordCriteria(value: unknown): LessonRecordCriterion[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.reduce<LessonRecordCriterion[]>((accumulator, entry) => {
    if (!isRecordObject(entry) || typeof entry.key !== 'string' || typeof entry.label !== 'string' || typeof entry.detail !== 'string') {
      return accumulator;
    }

    accumulator.push({
      key: entry.key,
      label: entry.label,
      isStable: Boolean(entry.isStable),
      stableRatio:
        typeof entry.stableRatio === 'number' && Number.isFinite(entry.stableRatio)
          ? Math.max(0, Math.min(1, entry.stableRatio))
          : undefined,
      detail: entry.detail,
    });

    return accumulator;
  }, []);
}

function normalizeLessonRecordHighlights(value: unknown): LessonRecordHighlight[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (!isRecordObject(entry) || typeof entry.label !== 'string' || typeof entry.detail !== 'string') {
        return null;
      }

      return {
        label: entry.label,
        detail: entry.detail,
        startAtMs:
          typeof entry.startAtMs === 'number' && Number.isFinite(entry.startAtMs) ? Math.max(0, entry.startAtMs) : 0,
        durationMs:
          typeof entry.durationMs === 'number' && Number.isFinite(entry.durationMs)
            ? clampHighlightDuration(entry.durationMs)
            : 2000,
      } satisfies LessonRecordHighlight;
    })
    .filter((entry): entry is LessonRecordHighlight => Boolean(entry));
}

function normalizeLessonRecordEvaluation(value: unknown): LessonRecordEvaluation | undefined {
  if (!isRecordObject(value) || typeof value.summary !== 'string') {
    return undefined;
  }

  const level: LessonRecordLevel =
    value.level === 'good' || value.level === 'average' || value.level === 'bad' ? value.level : 'bad';
  const criteria = normalizeLessonRecordCriteria(value.criteria);
  const strengths = normalizeLessonRecordHighlights(value.strengths);
  const improvements = normalizeLessonRecordHighlights(value.improvements);
  const shootCriteriaTotal = getShootEvaluationCriteriaTotal(criteria);
  const isShootEvaluation = shootCriteriaTotal > 0 && shootCriteriaTotal !== criteria.length;
  const stableCount = isShootEvaluation
    ? getShootEvaluationStableCount(criteria)
    : criteria.reduce((count, criterion) => count + (criterion.isStable ? 1 : 0), 0);
  const totalCount = isShootEvaluation ? shootCriteriaTotal : criteria.length;
  const normalizedLevel = isShootEvaluation ? buildShootLessonRecordLevel(stableCount) : level;
  const normalizedStrengths = ensureStrengthHighlightsCoverCriteria(criteria, strengths);

  return {
    level: normalizedLevel,
    summary:
      criteria.length > 0
        ? buildLessonRecordSummary(
            normalizedLevel,
            stableCount,
            totalCount
          )
        : value.summary,
    criteria,
    strengths: normalizedStrengths,
    improvements,
  };
}

function normalizeLessonRecord(
  record: (
    Omit<LessonRecord, 'feedbackTimeline' | 'thumbnailUri'> &
    { feedbackTimeline?: FeedbackMoment[] | string[]; thumbnailUri?: string }
  )
): LessonRecord {
  const normalizedFeedbackTimeline = normalizeFeedbackTimeline(record.feedbackTimeline, record.feedback);
  const normalizedShotOutcome =
    record.mode === 'shoot'
      ? record.shotOutcome === 'success'
        ? 'success'
        : record.shotOutcome === 'failure'
          ? 'failure'
          : undefined
      : undefined;
  const nextRecord = {
    ...record,
    shotOutcome: normalizedShotOutcome,
    thumbnailUri: typeof record.thumbnailUri === 'string' ? record.thumbnailUri : '',
    feedbackTimeline: normalizedFeedbackTimeline,
    evaluation: normalizeLessonRecordEvaluation(record.evaluation),
  } as LessonRecord;
  const representativeFeedbackCategory =
    nextRecord.representativeFeedbackCategory ?? getRepresentativeHomeworkFeedbackCategory(nextRecord) ?? undefined;

  if (!representativeFeedbackCategory) {
    return nextRecord;
  }

  return {
    ...nextRecord,
    representativeFeedbackCategory,
  };
}

function buildDevTestShootBadLessonRecord(date = new Date()): LessonRecord {
  return normalizeLessonRecord({
    id: DEV_TEST_SHOOT_RECORD_ID,
    dateKey: formatDateKey(date),
    mode: 'shoot',
    shotOutcome: 'failure',
    feedback: '테스트용 슛 피드백입니다. 무릎 각도와 릴리스 타이밍이 불안정했습니다.',
    feedbackTimeline: [
      {
        atMs: 0,
        text: '테스트용 슛 피드백입니다. 무릎 각도와 릴리스 타이밍이 불안정했습니다.',
      },
    ],
    videoUri: '',
    createdAt: date.toLocaleString('ko-KR'),
    representativeFeedbackCategory: 'leg_angle',
    evaluation: {
      level: 'bad',
      summary: '5가지 기준 중 0가지가 안정적이라 나쁨 기록입니다.',
      criteria: [
        {
          key: 'shoot-leg-angle',
          label: '무릎 각도',
          isStable: false,
          detail: '무릎 각도가 흔들려 하체 힘 전달이 일정하지 않았습니다.',
        },
        {
          key: 'shoot-release-timing',
          label: '슛 타이밍',
          isStable: false,
          detail: '릴리스 타이밍이 일정하지 않아 슛 흐름이 끊겼습니다.',
        },
        {
          key: 'shoot-release-point',
          label: '슛 타점',
          isStable: false,
          detail: '릴리스 타점이 낮아져 공이 짧게 나갈 수 있습니다.',
        },
        {
          key: 'shoot-release-duration',
          label: '릴리스 시간',
          isStable: false,
          detail: '릴리스 시간이 일정하지 않아 슛 리듬이 흔들렸습니다.',
        },
        {
          key: 'shoot-result',
          label: '슛 성공',
          isStable: false,
          detail: '이번 테스트 시도는 슛이 성공하지 않았습니다.',
        },
      ],
      strengths: [],
      improvements: [
        {
          label: '무릎 각도 보완이 필요합니다.',
          detail:
            '슛을 쏠 때 점프를 해 힘을 실어 쏴야 하기 때문에 무릎 각도가 중요합니다. 지금 무릎 각도는 152.0도 정도로 120~140도로 굽혀야 합니다. 더 굽혀서 쏴주세요.',
          startAtMs: 0,
          durationMs: 2000,
        },
        {
          label: '슛 타이밍 보완이 필요합니다.',
          detail:
            '슛을 쏠 때 점프와 동시에 슛을 쏘아 힘을 실어야 하기 때문에 슛 타이밍이 중요합니다. 지금 슛 타이밍은 느립니다. 점프와 동시에 슛을 쏘아야 합니다. 더 빨리 쏴주세요.',
          startAtMs: 0,
          durationMs: 2000,
        },
        {
          label: '슛 타점(위치) 보완이 필요합니다.',
          detail:
            '슛을 쏠 때 수비에게 막히지 않기 위해서 슛을 머리 위에 쏘는 것이 중요합니다. 지금 슛 타점(위치)가 낮습니다. 머리 위로 좀 더 높여 쏴주세요.',
          startAtMs: 0,
          durationMs: 2000,
        },
        {
          label: '릴리즈 속도 보완이 필요합니다.',
          detail:
            '수비수에게 막히지 않고 빠르게 슛을 쏴야 하기 때문에 릴리즈 시간이 짧아야 합니다. 지금 릴리즈 시간은 0.82초로 릴리즈 시간은 0.6초로 해야 합니다. 더 빨리 슛을 쏴보세요.',
          startAtMs: 0,
          durationMs: 2000,
        },
      ],
    },
  });
}

function normalizeLessonRecordVideoMap(value: unknown) {
  if (!isRecordObject(value)) {
    return {} as Record<string, string>;
  }

  return Object.entries(value).reduce<Record<string, string>>((accumulator, [recordId, videoUri]) => {
    if (typeof videoUri !== 'string' || !videoUri) {
      return accumulator;
    }

    accumulator[recordId] = videoUri;
    return accumulator;
  }, {});
}

function normalizeLessonRecordThumbnailMap(value: unknown) {
  if (!isRecordObject(value)) {
    return {} as Record<string, string>;
  }

  return Object.entries(value).reduce<Record<string, string>>((accumulator, [recordId, thumbnailUri]) => {
    if (typeof thumbnailUri !== 'string' || !thumbnailUri) {
      return accumulator;
    }

    accumulator[recordId] = thumbnailUri;
    return accumulator;
  }, {});
}

function buildLessonRecordVideoMap(records: LessonRecord[]) {
  return records.reduce<Record<string, string>>((accumulator, record) => {
    if (!record.videoUri) {
      return accumulator;
    }

    accumulator[record.id] = record.videoUri;
    return accumulator;
  }, {});
}

function buildLessonRecordThumbnailMap(records: LessonRecord[]) {
  return records.reduce<Record<string, string>>((accumulator, record) => {
    if (!record.thumbnailUri) {
      return accumulator;
    }

    accumulator[record.id] = record.thumbnailUri;
    return accumulator;
  }, {});
}

function buildStoredLessonRecordEntries(
  scopedKeys: ReturnType<typeof getAccountStorageKeys>,
  records: LessonRecord[]
): Array<[string, string]> {
  return [
    [scopedKeys.lessonRecords, JSON.stringify(stripLessonRecordMedia(records))],
    [scopedKeys.lessonRecordVideos, JSON.stringify(buildLessonRecordVideoMap(records))],
    [scopedKeys.lessonRecordThumbnails, JSON.stringify(buildLessonRecordThumbnailMap(records))],
  ];
}

async function persistLessonRecordVideoToFile(userId: string, recordId: string, videoUri: string) {
  const normalizedVideoUri = videoUri.trim();

  if (!normalizedVideoUri || Platform.OS === 'web') {
    return normalizedVideoUri;
  }

  const directory = buildLessonRecordVideoDirectory(userId);

  if (!directory) {
    return normalizedVideoUri;
  }

  const dataUrl = parseLessonRecordVideoDataUrl(normalizedVideoUri);
  const extension = getLessonRecordVideoExtension(normalizedVideoUri, dataUrl?.mimeType);
  const targetUri = buildManagedLessonRecordVideoUri(directory, recordId, extension);

  if (normalizedVideoUri === targetUri) {
    return targetUri;
  }

  try {
    await FileSystem.makeDirectoryAsync(directory, { intermediates: true });

    if (dataUrl) {
      const existingTarget = await FileSystem.getInfoAsync(targetUri);

      if (!existingTarget.exists) {
        await FileSystem.writeAsStringAsync(targetUri, dataUrl.base64, {
          encoding: FileSystem.EncodingType.Base64,
        });
      }

      return targetUri;
    }

    if (!normalizedVideoUri.startsWith('file://')) {
      return normalizedVideoUri;
    }

    const [sourceInfo, targetInfo] = await Promise.all([
      FileSystem.getInfoAsync(normalizedVideoUri),
      FileSystem.getInfoAsync(targetUri),
    ]);

    if (!sourceInfo.exists) {
      return normalizedVideoUri;
    }

    if (!targetInfo.exists) {
      await FileSystem.copyAsync({
        from: normalizedVideoUri,
        to: targetUri,
      });

      if (FileSystem.cacheDirectory && normalizedVideoUri.startsWith(FileSystem.cacheDirectory)) {
        await FileSystem.deleteAsync(normalizedVideoUri, { idempotent: true }).catch(() => {
          // Ignore cleanup failures after promoting the cached video to a persisted file.
        });
      }
    }

    return targetUri;
  } catch {
    return normalizedVideoUri;
  }
}

async function persistLessonRecordThumbnailToFile(
  userId: string,
  recordId: string,
  videoUri: string,
  thumbnailUri = ''
) {
  const normalizedVideoUri = videoUri.trim();
  const normalizedThumbnailUri = thumbnailUri.trim();

  if (!normalizedVideoUri) {
    return '';
  }

  if (Platform.OS === 'web') {
    if (normalizedThumbnailUri) {
      return normalizedThumbnailUri;
    }

    return (await generateLessonRecordThumbnail(normalizedVideoUri)) ?? '';
  }

  const directory = buildLessonRecordThumbnailDirectory(userId);

  if (!directory) {
    return normalizedThumbnailUri;
  }

  const targetUri = buildManagedLessonRecordThumbnailUri(directory, recordId);

  try {
    await FileSystem.makeDirectoryAsync(directory, { intermediates: true });

    const targetInfo = await FileSystem.getInfoAsync(targetUri);

    if (targetInfo.exists) {
      return targetUri;
    }

    if (normalizedThumbnailUri.startsWith('file://')) {
      const existingThumbnailInfo = await FileSystem.getInfoAsync(normalizedThumbnailUri);

      if (existingThumbnailInfo.exists) {
        await FileSystem.copyAsync({
          from: normalizedThumbnailUri,
          to: targetUri,
        });

        if (FileSystem.cacheDirectory && normalizedThumbnailUri.startsWith(FileSystem.cacheDirectory)) {
          await FileSystem.deleteAsync(normalizedThumbnailUri, { idempotent: true }).catch(() => {
            // Ignore cleanup failures after promoting the cached thumbnail to a persisted file.
          });
        }
      }

      const nextTargetInfo = await FileSystem.getInfoAsync(targetUri);

      if (nextTargetInfo.exists) {
        return targetUri;
      }
    }

    const generatedThumbnailUri = await generateLessonRecordThumbnail(normalizedVideoUri);

    if (!generatedThumbnailUri) {
      return normalizedThumbnailUri;
    }

    if (!generatedThumbnailUri.startsWith('file://')) {
      return generatedThumbnailUri;
    }

    const generatedInfo = await FileSystem.getInfoAsync(generatedThumbnailUri);

    if (!generatedInfo.exists) {
      return normalizedThumbnailUri;
    }

    await FileSystem.copyAsync({
      from: generatedThumbnailUri,
      to: targetUri,
    });

    if (FileSystem.cacheDirectory && generatedThumbnailUri.startsWith(FileSystem.cacheDirectory)) {
      await FileSystem.deleteAsync(generatedThumbnailUri, { idempotent: true }).catch(() => {
        // Ignore cleanup failures after promoting the cached thumbnail to a persisted file.
      });
    }

    return targetUri;
  } catch {
    return normalizedThumbnailUri;
  }
}

async function localizeLessonRecordMedia(userId: string, records: LessonRecord[]) {
  const localizedResults = await Promise.all(
    records.map(async (record) => {
      let nextRecord = record;
      let changed = false;

      if (nextRecord.videoUri) {
        const nextVideoUri = await persistLessonRecordVideoToFile(userId, nextRecord.id, nextRecord.videoUri);

        if (nextVideoUri !== nextRecord.videoUri) {
          nextRecord = normalizeLessonRecord({
            ...nextRecord,
            videoUri: nextVideoUri,
          });
          changed = true;
        }
      }

      const nextThumbnailUri = await persistLessonRecordThumbnailToFile(
        userId,
        nextRecord.id,
        nextRecord.videoUri,
        nextRecord.thumbnailUri
      );

      if (nextThumbnailUri !== nextRecord.thumbnailUri) {
        nextRecord = normalizeLessonRecord({
          ...nextRecord,
          thumbnailUri: nextThumbnailUri,
        });
        changed = true;
      }

      return {
        record: nextRecord,
        changed,
      };
    })
  );

  return {
    records: localizedResults.map((result) => result.record),
    didChange: localizedResults.some((result) => result.changed),
  };
}

function stripLessonRecordMedia(records: LessonRecord[]) {
  return records.map((record) =>
    record.videoUri || record.thumbnailUri
      ? {
          ...record,
          videoUri: '',
          thumbnailUri: '',
        }
      : record
  );
}

function hydrateLessonRecordMedia(
  records: LessonRecord[],
  videoMap: Record<string, string>,
  thumbnailMap: Record<string, string>
) {
  return records.map((record) =>
    videoMap[record.id] || thumbnailMap[record.id]
      ? normalizeLessonRecord({
          ...record,
          videoUri: videoMap[record.id] ?? record.videoUri,
          thumbnailUri: thumbnailMap[record.id] ?? record.thumbnailUri,
        })
      : record
  );
}

function hydrateLegacyShotOutcomes(
  records: LessonRecord[],
  legacyShotSuccessRecords: Record<string, number>
): LessonRecord[] {
  const nextRecords = [...records];
  const unresolvedByDate = new Map<string, number[]>();
  const existingSuccessCounts: Record<string, number> = {};

  records.forEach((record, index) => {
    if (record.mode !== 'shoot') {
      return;
    }

    if (record.shotOutcome === 'success') {
      existingSuccessCounts[record.dateKey] = (existingSuccessCounts[record.dateKey] || 0) + 1;
      return;
    }

    if (record.shotOutcome === 'failure') {
      return;
    }

    const pending = unresolvedByDate.get(record.dateKey) ?? [];
    pending.push(index);
    unresolvedByDate.set(record.dateKey, pending);
  });

  for (const [dateKey, indices] of unresolvedByDate.entries()) {
    let remainingSuccesses = Math.max(0, (legacyShotSuccessRecords[dateKey] || 0) - (existingSuccessCounts[dateKey] || 0));

    for (let index = indices.length - 1; index >= 0; index -= 1) {
      const recordIndex = indices[index];
      const record = nextRecords[recordIndex];

      nextRecords[recordIndex] = normalizeLessonRecord({
        ...record,
        shotOutcome: remainingSuccesses > 0 ? 'success' : 'failure',
      });

      if (remainingSuccesses > 0) {
        remainingSuccesses -= 1;
      }
    }
  }

  return nextRecords;
}

function deriveShotSuccessCounts(records: LessonRecord[]) {
  return records.reduce<Record<string, number>>((accumulator, record) => {
    if (record.mode !== 'shoot' || record.shotOutcome !== 'success') {
      return accumulator;
    }

    accumulator[record.dateKey] = (accumulator[record.dateKey] || 0) + 1;
    return accumulator;
  }, {});
}

function normalizeAccountSnapshot(payload: RemoteAccountSnapshot): RemoteAccountSnapshot {
  return {
    attendance: { ...payload.attendance },
    lessonRecords: payload.lessonRecords.map((record) => normalizeLessonRecord(record)),
    dribbleCounts: { ...payload.dribbleCounts },
    shotAttempts: { ...payload.shotAttempts },
    shotSuccess: { ...payload.shotSuccess },
    ballColors: payload.ballColors.length > 0 ? [...payload.ballColors] : [...DEFAULT_BALL_COLORS],
    ballBrand: payload.ballBrand,
    ballRecognitionProfile: sanitizeBallRecognitionProfile(payload.ballRecognitionProfile),
    position: payload.position,
    homework: sanitizeHomeworkStateRecord(payload.homework),
  };
}

function buildRemoteSnapshot(payload: RemoteAccountSnapshot): RemoteAccountSnapshot {
  const normalizedSnapshot = normalizeAccountSnapshot(payload);

  return {
    ...normalizedSnapshot,
    lessonRecords: stripLessonRecordMedia(normalizedSnapshot.lessonRecords),
  };
}

function buildLessonRecordSnapshotFromStoredEntries(
  scopedKeys: ReturnType<typeof getAccountStorageKeys>,
  stored: Record<string, string | null>,
  parsedShotSuccess: Record<string, number>
) {
  const parsedLessonRecords = sanitizeLessonRecords(parseStoredJson<unknown>(stored[scopedKeys.lessonRecords], []));
  const parsedLessonRecordVideos = normalizeLessonRecordVideoMap(
    parseStoredJson<unknown>(stored[scopedKeys.lessonRecordVideos], {})
  );
  const parsedLessonRecordThumbnails = normalizeLessonRecordThumbnailMap(
    parseStoredJson<unknown>(stored[scopedKeys.lessonRecordThumbnails], {})
  );
  const lessonRecordsWithVideos = hydrateLessonRecordMedia(
    parsedLessonRecords,
    parsedLessonRecordVideos,
    parsedLessonRecordThumbnails
  );
  return hydrateLegacyShotOutcomes(lessonRecordsWithVideos, parsedShotSuccess);
}

function mergeLessonRecordMedia(records: LessonRecord[], fallbackRecords: LessonRecord[]) {
  const fallbackVideoMap = fallbackRecords.reduce<Record<string, string>>((accumulator, record) => {
    if (record.videoUri) {
      accumulator[record.id] = record.videoUri;
    }

    return accumulator;
  }, {});
  const fallbackThumbnailMap = fallbackRecords.reduce<Record<string, string>>((accumulator, record) => {
    if (record.thumbnailUri) {
      accumulator[record.id] = record.thumbnailUri;
    }

    return accumulator;
  }, {});

  return records.map((record) =>
    ((!record.videoUri && fallbackVideoMap[record.id]) || (!record.thumbnailUri && fallbackThumbnailMap[record.id]))
      ? normalizeLessonRecord({
          ...record,
          videoUri: fallbackVideoMap[record.id] ?? record.videoUri,
          thumbnailUri: fallbackThumbnailMap[record.id] ?? record.thumbnailUri,
        })
      : record
  );
}

function mergeLessonRecordsWithFallback(records: LessonRecord[], fallbackRecords: LessonRecord[]) {
  const mergedRecords = mergeLessonRecordMedia(records, fallbackRecords);
  const mergedRecordIds = new Set(mergedRecords.map((record) => record.id));
  const fallbackOnlyRecords = fallbackRecords
    .filter((record) => !mergedRecordIds.has(record.id))
    .map((record) => normalizeLessonRecord(record));

  return [...mergedRecords, ...fallbackOnlyRecords];
}

function parseStoredAccountSnapshotFromEntries(
  scopedKeys: ReturnType<typeof getAccountStorageKeys>,
  stored: Record<string, string | null>
): RemoteAccountSnapshot {
  const parsedAttendance = sanitizeStringRecord(parseStoredJson<unknown>(stored[scopedKeys.attendance], {}));
  const parsedHomework = sanitizeHomeworkStateRecord(parseStoredJson<unknown>(stored[scopedKeys.homework], {}));
  const parsedDribbleCounts = sanitizeNumberRecord(parseStoredJson<unknown>(stored[scopedKeys.dribbleCounts], {}));
  const parsedShotAttempts = sanitizeNumberRecord(parseStoredJson<unknown>(stored[scopedKeys.shotAttempts], {}));
  const parsedShotSuccess = sanitizeNumberRecord(parseStoredJson<unknown>(stored[scopedKeys.shotSuccess], {}));
  const parsedBallBrand = parseStoredJson<unknown>(stored[scopedKeys.ballBrand], DEFAULT_BALL_BRAND);
  const parsedBallColors = parseStoredJson<unknown>(stored[scopedKeys.ballColors], DEFAULT_BALL_COLORS);
  const parsedBallRecognitionProfile = sanitizeBallRecognitionProfile(
    parseStoredJson<unknown>(stored[scopedKeys.ballRecognitionProfile], null)
  );
  const parsedPosition = parseStoredJson<unknown>(stored[scopedKeys.position], DEFAULT_POSITION);
  const hydratedLessonRecords = buildLessonRecordSnapshotFromStoredEntries(scopedKeys, stored, parsedShotSuccess);
  const mergedShotAttempts = { ...parsedShotAttempts };
  const derivedShotSuccess = deriveShotSuccessCounts(hydratedLessonRecords);
  const mergedShotSuccess = { ...parsedShotSuccess };
  const derivedShotAttempts = hydratedLessonRecords.reduce<Record<string, number>>((accumulator, record) => {
    if (record.mode !== 'shoot') {
      return accumulator;
    }

    accumulator[record.dateKey] = (accumulator[record.dateKey] || 0) + 1;
    return accumulator;
  }, {});

  for (const [dateKey, count] of Object.entries(derivedShotAttempts)) {
    mergedShotAttempts[dateKey] = Math.max(mergedShotAttempts[dateKey] || 0, count);
  }

  for (const [dateKey, count] of Object.entries(derivedShotSuccess)) {
    mergedShotSuccess[dateKey] = Math.max(mergedShotSuccess[dateKey] || 0, count);
  }

  return normalizeAccountSnapshot({
    attendance: parsedAttendance,
    lessonRecords: hydratedLessonRecords,
    dribbleCounts: parsedDribbleCounts,
    shotAttempts: mergedShotAttempts,
    shotSuccess: mergedShotSuccess,
    ballColors:
      Array.isArray(parsedBallColors) && parsedBallColors.filter(isBallColorOption).length > 0
        ? parsedBallColors.filter(isBallColorOption)
        : DEFAULT_BALL_COLORS,
    ballBrand: isBallBrandOption(parsedBallBrand) ? parsedBallBrand : DEFAULT_BALL_BRAND,
    ballRecognitionProfile: parsedBallRecognitionProfile,
    position: isPositionOption(parsedPosition) ? parsedPosition : DEFAULT_POSITION,
    homework: parsedHomework,
  });
}

async function readStoredAccountSnapshot(userId: string): Promise<RemoteAccountSnapshot> {
  const scopedKeys = getAccountStorageKeys(userId);
  const [entries, lessonRecordEntries] = await Promise.all([
    withTimeout(
      AppStorage.multiGet([
        scopedKeys.attendance,
        scopedKeys.homework,
        scopedKeys.dribbleCounts,
        scopedKeys.shotAttempts,
        scopedKeys.shotSuccess,
        scopedKeys.ballColors,
        scopedKeys.ballBrand,
        scopedKeys.ballRecognitionProfile,
        scopedKeys.position,
      ]),
      STORAGE_LOAD_TIMEOUT_MS,
      [
        [scopedKeys.attendance, null],
        [scopedKeys.homework, null],
        [scopedKeys.dribbleCounts, null],
        [scopedKeys.shotAttempts, null],
        [scopedKeys.shotSuccess, null],
        [scopedKeys.ballColors, null],
        [scopedKeys.ballBrand, null],
        [scopedKeys.ballRecognitionProfile, null],
        [scopedKeys.position, null],
      ] as [string, string | null][]
    ),
    getLessonRecordEntriesWithMigration([
      scopedKeys.lessonRecords,
      scopedKeys.lessonRecordVideos,
      scopedKeys.lessonRecordThumbnails,
    ]),
  ]);
  const stored = Object.fromEntries([...entries, ...lessonRecordEntries]);
  const parsedSnapshot = parseStoredAccountSnapshotFromEntries(scopedKeys, stored);
  const localizedLessonRecords = await localizeLessonRecordMedia(userId, parsedSnapshot.lessonRecords);

  if (!localizedLessonRecords.didChange) {
    return parsedSnapshot;
  }

  const migratedSnapshot = {
    ...parsedSnapshot,
    lessonRecords: localizedLessonRecords.records,
  } satisfies RemoteAccountSnapshot;

  await setLessonRecordEntries(buildStoredLessonRecordEntries(scopedKeys, migratedSnapshot.lessonRecords)).catch(() => {
    // Ignore storage rewrite failures here and keep the in-memory migrated file paths.
  });

  return migratedSnapshot;
}

async function writeStoredAccountSnapshot(
  userId: string,
  snapshot: RemoteAccountSnapshot,
  options?: { preserveExistingLessonRecords?: boolean }
) {
  const scopedKeys = getAccountStorageKeys(userId);
  const nextSnapshot = normalizeAccountSnapshot(snapshot);
  const existingLessonRecordEntries = await getLessonRecordEntriesWithMigration([
    scopedKeys.lessonRecords,
    scopedKeys.lessonRecordVideos,
    scopedKeys.lessonRecordThumbnails,
  ]);
  const existingStoredLessonRecords = buildLessonRecordSnapshotFromStoredEntries(
    scopedKeys,
    Object.fromEntries(existingLessonRecordEntries),
    nextSnapshot.shotSuccess
  );
  const shouldPreserveExistingLessonRecords = options?.preserveExistingLessonRecords !== false;
  const lessonRecordsWithVideos = shouldPreserveExistingLessonRecords
    ? mergeLessonRecordsWithFallback(nextSnapshot.lessonRecords, existingStoredLessonRecords)
    : nextSnapshot.lessonRecords;
  const localizedLessonRecords = await localizeLessonRecordMedia(userId, lessonRecordsWithVideos);
  const storedSnapshot = {
    ...nextSnapshot,
    lessonRecords: localizedLessonRecords.records,
  } satisfies RemoteAccountSnapshot;

  await setLessonRecordEntries(buildStoredLessonRecordEntries(scopedKeys, storedSnapshot.lessonRecords));

  await AppStorage.multiSet([
    [scopedKeys.attendance, JSON.stringify(storedSnapshot.attendance)],
    [scopedKeys.homework, JSON.stringify(storedSnapshot.homework)],
    [scopedKeys.dribbleCounts, JSON.stringify(storedSnapshot.dribbleCounts)],
    [scopedKeys.shotAttempts, JSON.stringify(storedSnapshot.shotAttempts)],
    [scopedKeys.shotSuccess, JSON.stringify(storedSnapshot.shotSuccess)],
    [scopedKeys.ballColors, JSON.stringify(storedSnapshot.ballColors)],
    [scopedKeys.ballBrand, JSON.stringify(storedSnapshot.ballBrand)],
    [scopedKeys.ballRecognitionProfile, JSON.stringify(storedSnapshot.ballRecognitionProfile)],
    [scopedKeys.position, JSON.stringify(storedSnapshot.position)],
  ]);

  return storedSnapshot;
}

function parseDateKeyToTime(dateKey: string) {
  const [yearText, monthText, dayText] = dateKey.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return 0;
  }

  return new Date(year, month - 1, day).getTime();
}

function buildLessonRecordLevel(stableCount: number, totalCount: number): LessonRecordLevel {
  if (totalCount >= 5) {
    if (stableCount >= 4) {
      return 'good';
    }

    if (stableCount >= 2) {
      return 'average';
    }

    return 'bad';
  }

  if (totalCount >= 4) {
    if (stableCount >= 3) {
      return 'good';
    }

    if (stableCount >= 2) {
      return 'average';
    }

    return 'bad';
  }

  if (stableCount >= totalCount) {
    return 'good';
  }

  if (stableCount >= Math.max(1, totalCount - 1)) {
    return 'average';
  }

  return 'bad';
}

function getShootEvaluationStableCount(criteria: LessonRecordCriterion[]) {
  return criteria.reduce((count, criterion) => {
    if (criterion.key === 'shoot-result') {
      return count;
    }

    return count + (criterion.isStable ? 1 : 0);
  }, 0);
}

function getShootEvaluationCriteriaTotal(criteria: LessonRecordCriterion[]) {
  return criteria.filter((criterion) => criterion.key !== 'shoot-result').length;
}

function buildShootLessonRecordLevel(stableCount: number): LessonRecordLevel {
  if (stableCount >= 3) {
    return 'good';
  }

  if (stableCount >= 2) {
    return 'average';
  }

  return 'bad';
}

function getLessonRecordLevelLabel(level: LessonRecordLevel) {
  if (level === 'good') {
    return '좋음';
  }

  if (level === 'average') {
    return '보통';
  }

  return '나쁨';
}

function normalizeCalendarLessonRecordLevelCounts(counts: Record<LessonRecordLevel, number>) {
  const normalizedCounts: Record<LessonRecordLevel, number> = {
    good: Math.max(0, counts.good),
    average: Math.max(0, counts.average),
    bad: Math.max(0, counts.bad),
  };
  const offsetCount = Math.min(normalizedCounts.good, normalizedCounts.bad);

  if (offsetCount > 0) {
    normalizedCounts.good -= offsetCount;
    normalizedCounts.bad -= offsetCount;
    normalizedCounts.average += offsetCount;
  }

  return normalizedCounts;
}

function getDominantCalendarLessonRecordLevel(counts: Record<LessonRecordLevel, number>) {
  const normalizedCounts = normalizeCalendarLessonRecordLevelCounts(counts);
  const rankedLevels = (Object.entries(normalizedCounts) as [LessonRecordLevel, number][])
    .sort((left, right) => right[1] - left[1]);

  if (!rankedLevels[0] || rankedLevels[0][1] <= 0) {
    return null;
  }

  if (rankedLevels[0][1] === rankedLevels[1]?.[1]) {
    return null;
  }

  return rankedLevels[0][0];
}

function buildLessonRecordSummary(level: LessonRecordLevel, stableCount: number, totalCount: number) {
  return `${totalCount}가지 기준 중 ${stableCount}가지가 안정적이라 ${getLessonRecordLevelLabel(level)} 기록입니다.`;
}

function clampHighlightDuration(durationMs: number) {
  return Math.max(1500, Math.min(3200, Math.round(durationMs)));
}

function buildRecordHighlight(
  label: string,
  detail: string,
  startAtMs: number,
  durationMs: number
): LessonRecordHighlight {
  return {
    label,
    detail,
    startAtMs: Math.max(0, Math.round(startAtMs)),
    durationMs: clampHighlightDuration(durationMs),
  };
}

function shouldCreateStrengthHighlightFromCriterion(criterion: LessonRecordCriterion) {
  return criterion.isStable && criterion.key !== 'shoot-result';
}

function ensureStrengthHighlightsCoverCriteria(
  criteria: LessonRecordCriterion[],
  strengths: LessonRecordHighlight[]
) {
  const nextStrengths = [...strengths];
  const existingDetails = new Set(
    nextStrengths.map((highlight) => highlight.detail.trim()).filter(Boolean)
  );

  for (const criterion of criteria) {
    if (!shouldCreateStrengthHighlightFromCriterion(criterion)) {
      continue;
    }

    const detail = criterion.detail.trim();

    if (!detail || existingDetails.has(detail)) {
      continue;
    }

    nextStrengths.push(
      buildRecordHighlight(`${criterion.label} 안정`, detail, 0, 2200)
    );
    existingDetails.add(detail);
  }

  return nextStrengths;
}

function findLongestHighlightWindow<T>(
  frames: Array<{ atMs: number; analysis: T }>,
  predicate: (analysis: T) => boolean
) {
  let bestStartIndex = -1;
  let bestEndIndex = -1;
  let currentStartIndex = -1;

  frames.forEach((frame, index) => {
    if (predicate(frame.analysis)) {
      if (currentStartIndex === -1) {
        currentStartIndex = index;
      }

      return;
    }

    if (currentStartIndex === -1) {
      return;
    }

    if (
      bestStartIndex === -1 ||
      index - currentStartIndex > bestEndIndex - bestStartIndex + 1
    ) {
      bestStartIndex = currentStartIndex;
      bestEndIndex = index - 1;
    }

    currentStartIndex = -1;
  });

  if (currentStartIndex !== -1) {
    if (
      bestStartIndex === -1 ||
      frames.length - currentStartIndex > bestEndIndex - bestStartIndex + 1
    ) {
      bestStartIndex = currentStartIndex;
      bestEndIndex = frames.length - 1;
    }
  }

  if (bestStartIndex === -1 || bestEndIndex === -1) {
    return null;
  }

  const startAtMs = Math.max(0, frames[bestStartIndex].atMs - 450);
  const endAtMs = frames[bestEndIndex].atMs + 900;

  return {
    startAtMs,
    durationMs: clampHighlightDuration(endAtMs - startAtMs),
  };
}

function buildShootLegAngleDetail(analysis: ShootAnalysis | null, isStable: boolean) {
  if (!analysis) {
    return isStable
      ? '무릎 각도가 안정적으로 유지되었습니다.'
      : '무릎 각도를 조금 더 안정적으로 맞출 필요가 있습니다.';
  }

  if (isStable) {
    return '무릎 각도가 안정적으로 유지되었습니다.';
  }

  if (analysis.legAngleState === 'low') {
    return '무릎 사용이 부족합니다. 준비 자세를 조금 더 낮춰 점프 힘을 만들어 주세요.';
  }

  if (analysis.legAngleState === 'high') {
    return '무릎이 너무 많이 접혀 있습니다. 상체와 하체 균형을 다시 맞춰 주세요.';
  }

  return '무릎 각도를 조금 더 일정하게 유지해 보세요.';
}

function buildShootTimingDetail(analysis: ShootAnalysis | null, isStable: boolean) {
  if (!analysis) {
    return isStable
      ? '무릎과 팔의 타이밍이 안정적으로 맞았습니다.'
      : '무릎과 팔의 타이밍을 조금 더 일정하게 맞출 필요가 있습니다.';
  }

  if (isStable) {
    return '무릎과 팔이 함께 올라오며 릴리스 타이밍이 안정적으로 맞았습니다.';
  }

  if (analysis.releaseTiming === 'early') {
    return '릴리스가 조금 빠릅니다. 몸이 올라오는 흐름에 맞춰 손을 뻗어 주세요.';
  }

  if (analysis.releaseTiming === 'late') {
    return '릴리스가 조금 늦습니다. 최고점에 가까워질 때 공을 놓아 주세요.';
  }

  return '릴리스 타이밍을 다시 확인할 수 있도록 동작이 더 선명하게 보이게 촬영해 주세요.';
}

function formatAngleDegrees(angle: number | null) {
  return angle !== null ? `${angle.toFixed(1)}도` : null;
}

function formatReleaseDurationSeconds(durationMs: number | null) {
  return durationMs !== null ? `${(durationMs / 1000).toFixed(2)}초` : '--';
}

function buildShootLegAngleImprovementReason(analysis: ShootAnalysis | null) {
  const measuredAngle = analysis?.lowestLegAngle ?? analysis?.legAngle ?? null;
  const angleText = formatAngleDegrees(measuredAngle);

  if (angleText === null) {
    return '슛을 쏠 때 점프를 해 힘을 실어 쏴야 하기 때문에 무릎 각도가 중요합니다. 지금 무릎 각도는 정확히 확인되지 않았습니다. 120~140도로 굽혀야 합니다. 무릎 각도를 다시 맞춰 주세요.';
  }

  if (measuredAngle !== null && measuredAngle < 120) {
    return `슛을 쏠 때 점프를 해 힘을 실어 쏴야 하기 때문에 무릎 각도가 중요합니다. 지금 무릎 각도는 ${angleText} 정도로 120~140도로 굽혀야 합니다. 더 벌려서 쏴주세요.`;
  }

  if (measuredAngle !== null && measuredAngle > 140) {
    return `슛을 쏠 때 점프를 해 힘을 실어 쏴야 하기 때문에 무릎 각도가 중요합니다. 지금 무릎 각도는 ${angleText} 정도로 120~140도로 굽혀야 합니다. 더 굽혀서 쏴주세요.`;
  }

  return `슛을 쏠 때 점프를 해 힘을 실어 쏴야 하기 때문에 무릎 각도가 중요합니다. 지금 무릎 각도는 ${angleText} 정도입니다. 120~140도로 일정하게 유지해 주세요.`;
}

function buildShootTimingImprovementReason(analysis: ShootAnalysis | null) {
  if (analysis?.releaseTiming === 'early') {
    return '슛을 쏠 때 점프와 동시에 슛을 쏘아 힘을 실어야 하기 때문에 슛 타이밍이 중요합니다. 지금 슛 타이밍은 빠릅니다. 점프와 동시에 슛을 쏘아야 합니다. 더 늦게 쏴주세요.';
  }

  if (analysis?.releaseTiming === 'late') {
    return '슛을 쏠 때 점프와 동시에 슛을 쏘아 힘을 실어야 하기 때문에 슛 타이밍이 중요합니다. 지금 슛 타이밍은 느립니다. 점프와 동시에 슛을 쏘아야 합니다. 더 빨리 쏴주세요.';
  }

  return '슛을 쏠 때 점프와 동시에 슛을 쏘아 힘을 실어야 하기 때문에 슛 타이밍이 중요합니다. 지금 슛 타이밍은 정확히 확인되지 않았습니다. 점프와 동시에 슛을 쏘아야 합니다.';
}

function buildShootReleasePointImprovementReason(analysis: ShootAnalysis | null) {
  if (analysis?.releasePointState === 'low') {
    return '슛을 쏠 때 수비에게 막히지 않기 위해서 슛을 머리 위에 쏘는 것이 중요합니다. 지금 슛 타점(위치)가 낮습니다. 머리 위로 좀 더 높여 쏴주세요.';
  }

  return '슛을 쏠 때 수비에게 막히지 않기 위해서 슛을 머리 위에 쏘는 것이 중요합니다. 지금 슛 타점(위치)를 정확히 확인하지 못했습니다. 머리 위로 좀 더 높여 쏴주세요.';
}

function buildShootReleaseDurationImprovementReason(analysis: ShootAnalysis | null) {
  const durationText = formatReleaseDurationSeconds(analysis?.releaseDurationMs ?? null);

  if (analysis?.releaseDurationState === 'slow') {
    return `수비수에게 막히지 않고 빠르게 슛을 쏴야 하기 때문에 릴리즈 시간이 짧아야 합니다. 지금 릴리즈 시간은 ${durationText}로 릴리즈 시간은 0.6초로 해야 합니다. 더 빨리 슛을 쏴보세요.`;
  }

  return '수비수에게 막히지 않고 빠르게 슛을 쏴야 하기 때문에 릴리즈 시간이 짧아야 합니다. 지금 릴리즈 시간은 정확히 확인되지 않았습니다. 릴리즈 시간은 0.6초로 해야 합니다. 더 빨리 슛을 쏴보세요.';
}

function buildShootReleasePointDetail(analysis: ShootAnalysis | null, isStable: boolean) {
  if (!analysis) {
    return isStable
      ? '릴리스 높이가 머리 위쪽에서 형성되어 안정적입니다.'
      : '릴리스 높이를 머리보다 조금 더 높게 가져갈 필요가 있습니다.';
  }

  if (isStable) {
    return '릴리스 직전 공의 위치가 머리 위쪽에서 유지되어 높이가 좋습니다.';
  }

  if (analysis.releasePointState === 'low') {
    return '릴리스 직전 공의 위치가 머리보다 낮습니다. 공을 조금 더 높게 밀어 올려 주세요.';
  }

  return '릴리스 높이를 충분히 확인하지 못했습니다. 머리와 공이 함께 보이도록 다시 촬영해 주세요.';
}

function buildShootReleaseDurationDetail(analysis: ShootAnalysis | null, isStable: boolean) {
  if (!analysis) {
    return isStable
      ? '릴리스 시간이 0.6초 기준 안에서 안정적입니다.'
      : '릴리스 시간을 0.6초 안쪽으로 더 짧게 맞출 필요가 있습니다.';
  }

  if (isStable) {
    return `릴리스까지 ${formatReleaseDurationSeconds(analysis.releaseDurationMs)}가 걸렸고, 0.6초 기준 안에서 안정적입니다.`;
  }

  if (analysis.releaseDurationState === 'slow') {
    return `릴리스까지 ${formatReleaseDurationSeconds(analysis.releaseDurationMs)}가 걸렸습니다. 손목 스냅을 조금 더 빠르게 가져가 주세요.`;
  }

  return '릴리스 시간을 충분히 확인하지 못했습니다. 손목과 공이 끝까지 보이도록 다시 촬영해 주세요.';
}

function buildShootRecordEvaluation(
  analysis: ShootAnalysis | null,
  frames: TimedShootAnalysis[],
  shotOutcome: LessonRecord['shotOutcome']
): LessonRecordEvaluation {
  const legAngleStable = analysis?.legAngleState === 'balanced';
  const releaseTimingStable = analysis?.releaseTiming === 'balanced';
  const releasePointStable = analysis?.releasePointState === 'high';
  const releaseDurationStable = analysis?.releaseDurationState === 'balanced';
  const shotSucceeded = shotOutcome === 'success';
  const stableCount = [legAngleStable, releaseTimingStable, releasePointStable, releaseDurationStable].filter(Boolean).length;
  const level = buildShootLessonRecordLevel(stableCount);
  const criteria: LessonRecordCriterion[] = [
    {
      key: 'shoot-leg-angle',
      label: '무릎 각도',
      isStable: legAngleStable,
      detail: buildShootLegAngleDetail(analysis, legAngleStable),
    },
    {
      key: 'shoot-release-timing',
      label: '릴리스 타이밍',
      isStable: releaseTimingStable,
      detail: buildShootTimingDetail(analysis, releaseTimingStable),
    },
    {
      key: 'shoot-release-point',
      label: '릴리스 높이',
      isStable: releasePointStable,
      detail: buildShootReleasePointDetail(analysis, releasePointStable),
    },
    {
      key: 'shoot-release-duration',
      label: '릴리스 시간',
      isStable: releaseDurationStable,
      detail: buildShootReleaseDurationDetail(analysis, releaseDurationStable),
    },
    {
      key: 'shoot-result',
      label: '슛 성공',
      isStable: shotSucceeded,
      detail: shotSucceeded ? '슛이 성공했습니다.' : '슛이 성공까지 이어지지 않았습니다.',
    },
  ];
  const strengths: LessonRecordHighlight[] = [];
  const improvements: LessonRecordHighlight[] = [];

  if (legAngleStable) {
    const window = findLongestHighlightWindow(frames, (item) => item.legAngleState === 'balanced');
    strengths.push(
      buildRecordHighlight(
        '무릎 각도 안정',
        buildShootLegAngleDetail(analysis, true),
        window?.startAtMs ?? 0,
        window?.durationMs ?? 2200
      )
    );
  } else {
    const window = findLongestHighlightWindow(
      frames,
      (item) => item.legAngleState === 'low' || item.legAngleState === 'high'
    );
    improvements.push(
      buildRecordHighlight(
        '무릎 각도 보완이 필요합니다.',
        buildShootLegAngleImprovementReason(analysis),
        window?.startAtMs ?? 0,
        window?.durationMs ?? 2200
      )
    );
  }

  if (releaseTimingStable) {
    const window = findLongestHighlightWindow(frames, (item) => item.releaseTiming === 'balanced');
    strengths.push(
      buildRecordHighlight(
        '릴리스 타이밍 안정',
        buildShootTimingDetail(analysis, true),
        window?.startAtMs ?? 0,
        window?.durationMs ?? 2200
      )
    );
  } else {
    const window = findLongestHighlightWindow(
      frames,
      (item) => item.releaseTiming === 'early' || item.releaseTiming === 'late'
    );
    improvements.push(
      buildRecordHighlight(
        '슛 타이밍 보완이 필요합니다.',
        buildShootTimingImprovementReason(analysis),
        window?.startAtMs ?? 0,
        window?.durationMs ?? 2200
      )
    );
  }

  if (releasePointStable) {
    const window = findLongestHighlightWindow(frames, (item) => item.releasePointState === 'high');
    strengths.push(
      buildRecordHighlight(
        '릴리스 높이 안정',
        buildShootReleasePointDetail(analysis, true),
        window?.startAtMs ?? 0,
        window?.durationMs ?? 2200
      )
    );
  } else {
    const window = findLongestHighlightWindow(
      frames,
      (item) => item.releasePointState === 'low'
    );
    improvements.push(
      buildRecordHighlight(
        '슛 타점(위치) 보완이 필요합니다.',
        buildShootReleasePointImprovementReason(analysis),
        window?.startAtMs ?? 0,
        window?.durationMs ?? 2200
      )
    );
  }

  if (releaseDurationStable) {
    const window = findLongestHighlightWindow(frames, (item) => item.releaseDurationState === 'balanced');
    strengths.push(
      buildRecordHighlight(
        '릴리스 시간 안정',
        buildShootReleaseDurationDetail(analysis, true),
        window?.startAtMs ?? 0,
        window?.durationMs ?? 2200
      )
    );
  } else {
    const window = findLongestHighlightWindow(
      frames,
      (item) => item.releaseDurationState === 'slow'
    );
    improvements.push(
      buildRecordHighlight(
        '릴리즈 속도 보완이 필요합니다.',
        buildShootReleaseDurationImprovementReason(analysis),
        window?.startAtMs ?? 0,
        window?.durationMs ?? 2200
      )
    );
  }

  return {
    level,
    summary: buildLessonRecordSummary(level, stableCount, 4),
    criteria,
    strengths,
    improvements,
  };
}

function updateShootRecordEvaluationForOutcome(
  record: LessonRecord,
  nextShotOutcome: 'success' | 'failure'
): LessonRecordEvaluation | undefined {
  if (!record.evaluation) {
    return undefined;
  }

  const nextCriteria = record.evaluation.criteria.map((criterion) =>
    criterion.key === 'shoot-result'
      ? {
          ...criterion,
          isStable: nextShotOutcome === 'success',
          detail: nextShotOutcome === 'success' ? '슛이 성공했습니다.' : '슛이 성공까지 이어지지 않았습니다.',
        }
      : criterion
  );
  const stableCount = getShootEvaluationStableCount(nextCriteria);
  const criteriaTotal = getShootEvaluationCriteriaTotal(nextCriteria);
  const level = buildShootLessonRecordLevel(stableCount);
  const strengths = record.evaluation.strengths.filter((item) => item.label !== '슛 성공 장면');
  const improvements = record.evaluation.improvements.filter((item) => item.label !== '슛 결과 보완');

  return {
    ...record.evaluation,
    level,
    summary: buildLessonRecordSummary(level, stableCount, criteriaTotal || 4),
    criteria: nextCriteria,
    strengths,
    improvements,
  };
}

function calculateStableRatio<T>(
  frames: Array<{ atMs: number; analysis: T }>,
  predicate: (analysis: T) => boolean
) {
  if (frames.length === 0) {
    return 0;
  }

  const stableCount = frames.filter((frame) => predicate(frame.analysis)).length;
  return stableCount / frames.length;
}

function formatStableRatioText(ratio: number) {
  return String(Math.round(ratio * 100)) + '%';
}

function buildDribbleRhythmDetail(analysis: DribbleAnalysis | null, isStable: boolean) {
  if (!analysis || analysis.dribbleRhythmState === 'unknown' || analysis.dribbleRhythmComparisonCount <= 0) {
    return '드리블 리듬을 판단할 만큼 드리블 간격 데이터가 충분하지 않습니다.';
  }

  const comparisonCount = analysis.dribbleRhythmComparisonCount;
  const goodCount = analysis.dribbleRhythmGoodCount;
  const badCount = analysis.dribbleRhythmBadCount;

  if (isStable) {
    return `드리블 간격 비교 ${comparisonCount}회 중 ${goodCount}회가 0.2초 이하 차이로 유지되었습니다.`;
  }

  return `드리블 간격 비교 ${comparisonCount}회 중 ${badCount}회에서 0.2초 이상 차이가 났습니다. 리듬 보완이 필요합니다.`;
}

function buildFrontDribbleStanceDetail(analysis: DribbleAnalysis | null, isStable: boolean) {
  if (!analysis || analysis.frontStanceAngle === null) {
    return '무릎 각도를 판단할 만큼 하체 데이터가 충분하지 않습니다.';
  }

  if (isStable) {
    return `무릎 각도가 ${analysis.frontStanceAngle.toFixed(1)}도로 안정적입니다. 140~170도 범위를 잘 유지했습니다.`;
  }

  return `무릎 각도가 ${analysis.frontStanceAngle.toFixed(1)}도입니다. 140~170도에 가깝게 다시 맞춰 주세요.`;
}

function buildFrontDribbleBallLaneDetail(analysis: DribbleAnalysis | null, isStable: boolean) {
  if (!analysis || analysis.frontBallLaneState === 'unknown') {
    return '공 라인을 판단할 만큼 정면 드리블 데이터가 충분하지 않습니다.';
  }

  if (isStable) {
    return '공이 다리 바깥쪽 라인에서 드리블되었습니다. 공 라인이 안정적입니다.';
  }

  return '공이 다리 사이로 들어가는 장면이 보입니다. 공을 몸 바깥쪽 라인에서 드리블해 주세요.';
}

function buildFrontDribbleHandBalanceDetail(analysis: DribbleAnalysis | null, isStable: boolean) {
  const leftCount = Math.max(0, analysis?.leftHandDribbleCount ?? 0);
  const rightCount = Math.max(0, analysis?.rightHandDribbleCount ?? 0);
  const totalCount = leftCount + rightCount;

  if (!analysis || totalCount <= 0) {
    return '양손 균형을 판단할 만큼 드리블 횟수 데이터가 충분하지 않습니다.';
  }

  if (isStable) {
    return `왼손 ${leftCount}번, 오른손 ${rightCount}번으로 양손 균형이 좋습니다.`;
  }

  return `왼손 ${leftCount}번, 오른손 ${rightCount}번으로 차이가 있습니다. 양손 균형을 맞춰 주세요.`;
}

function buildFrontDribbleFootSpacingDetail(analysis: DribbleAnalysis | null, isStable: boolean) {
  if (!analysis || analysis.footSpacingState === 'unknown') {
    return '발 간격을 판단할 만큼 하체 데이터가 충분하지 않습니다.';
  }

  if (isStable) {
    return '발 간격이 안정적입니다. 지금 간격을 유지해 주세요.';
  }

  if (analysis.footSpacingState === 'narrow') {
    return '발 간격이 어깨보다 좁습니다. 조금 더 벌려 주세요.';
  }

  return '발 간격이 너무 넓습니다. 조금만 좁혀 주세요.';
}

function buildFrontDribbleRecordEvaluation(
  frames: TimedDribbleAnalysis[],
  latestAnalysis: DribbleAnalysis | null
): LessonRecordEvaluation {
  const activeFrames = frames.filter((frame) => frame.analysis.dribbleStarted);
  const stanceStableRatio = calculateStableRatio(
    activeFrames,
    (analysis) => analysis.frontStanceAngle !== null && analysis.frontStanceAngle >= 140 && analysis.frontStanceAngle <= 170
  );
  const ballLaneStableRatio = calculateStableRatio(
    activeFrames,
    (analysis) => analysis.frontBallLaneState === 'outside_legs'
  );
  const eyeStableRatio = calculateStableRatio(
    activeFrames,
    (analysis) => analysis.eyeFocus === 'forward'
  );
  const footSpacingStableRatio = calculateStableRatio(
    activeFrames,
    (analysis) => analysis.footSpacingState === 'balanced'
  );
  const stanceStable = stanceStableRatio >= 0.5;
  const ballLaneStable = ballLaneStableRatio >= 0.5;
  const eyeStable = eyeStableRatio >= 0.5;
  const rhythmStable = latestAnalysis?.dribbleRhythmState === 'good';
  const rhythmGoodRatio =
    latestAnalysis && typeof latestAnalysis.dribbleRhythmBadRatio === 'number'
      ? Math.max(0, 1 - latestAnalysis.dribbleRhythmBadRatio)
      : undefined;
  const footSpacingStable = footSpacingStableRatio >= 0.5;
  const criteria: LessonRecordCriterion[] = [
    {
      key: 'dribble-front-stance-angle',
      label: '무릎 각도',
      isStable: stanceStable,
      stableRatio: stanceStableRatio,
      detail: buildFrontDribbleStanceDetail(latestAnalysis, stanceStable),
    },
    {
      key: 'dribble-front-ball-lane',
      label: '공 라인',
      isStable: ballLaneStable,
      stableRatio: ballLaneStableRatio,
      detail: buildFrontDribbleBallLaneDetail(latestAnalysis, ballLaneStable),
    },
    {
      key: 'dribble-eye-focus',
      label: '시선 처리',
      isStable: eyeStable,
      stableRatio: eyeStableRatio,
      detail: eyeStable
        ? `시선이 ${formatStableRatioText(eyeStableRatio)} 구간에서 앞을 향했습니다.`
        : `시선이 앞을 본 구간은 ${formatStableRatioText(eyeStableRatio)}였습니다. 공보다 앞을 보는 시간을 더 늘려 주세요.`,
    },
    {
      key: 'dribble-rhythm',
      label: '드리블 리듬',
      isStable: rhythmStable,
      stableRatio: rhythmGoodRatio,
      detail: buildDribbleRhythmDetail(latestAnalysis, rhythmStable),
    },
    {
      key: 'dribble-front-foot-spacing',
      label: '발 간격',
      isStable: footSpacingStable,
      stableRatio: footSpacingStableRatio,
      detail: buildFrontDribbleFootSpacingDetail(latestAnalysis, footSpacingStable),
    },
  ];
  const stableCount = criteria.filter((criterion) => criterion.isStable).length;
  const level = buildLessonRecordLevel(stableCount, criteria.length || 3);
  const strengths: LessonRecordHighlight[] = [];
  const improvements: LessonRecordHighlight[] = [];

  if (stanceStable) {
    const window = findLongestHighlightWindow(
      activeFrames,
      (analysis) => analysis.frontStanceAngle !== null && analysis.frontStanceAngle >= 140 && analysis.frontStanceAngle <= 170
    );
    strengths.push(buildRecordHighlight('무릎 각도 안정', criteria[0].detail, window?.startAtMs ?? 0, window?.durationMs ?? 2200));
  } else {
    const window = findLongestHighlightWindow(
      activeFrames,
      (analysis) => analysis.frontStanceAngle !== null && (analysis.frontStanceAngle < 140 || analysis.frontStanceAngle > 170)
    );
    improvements.push(buildRecordHighlight('무릎 각도 보완', criteria[0].detail, window?.startAtMs ?? 0, window?.durationMs ?? 2200));
  }

  if (ballLaneStable) {
    const window = findLongestHighlightWindow(activeFrames, (analysis) => analysis.frontBallLaneState === 'outside_legs');
    strengths.push(buildRecordHighlight('공 라인 안정', criteria[1].detail, window?.startAtMs ?? 0, window?.durationMs ?? 2200));
  } else {
    const window = findLongestHighlightWindow(
      activeFrames,
      (analysis) => analysis.frontBallLaneState === 'between_legs'
    );
    improvements.push(buildRecordHighlight('공 라인 보완', criteria[1].detail, window?.startAtMs ?? 0, window?.durationMs ?? 2200));
  }

  if (eyeStable) {
    const window = findLongestHighlightWindow(activeFrames, (analysis) => analysis.eyeFocus === 'forward');
    strengths.push(buildRecordHighlight('시선 처리 안정', criteria[2].detail, window?.startAtMs ?? 0, window?.durationMs ?? 2200));
  } else {
    const window = findLongestHighlightWindow(activeFrames, (analysis) => analysis.eyeFocus === 'ball');
    improvements.push(buildRecordHighlight('시선 처리 보완', criteria[2].detail, window?.startAtMs ?? 0, window?.durationMs ?? 2200));
  }

  if (rhythmStable) {
    const window = findLongestHighlightWindow(activeFrames, (analysis) => analysis.dribbleRhythmState === 'good');
    strengths.push(buildRecordHighlight('리듬 유지', criteria[3].detail, window?.startAtMs ?? 0, window?.durationMs ?? 2200));
  } else {
    const window = findLongestHighlightWindow(
      activeFrames,
      (analysis) => analysis.dribbleRhythmState === 'needs_improvement'
    );
    improvements.push(buildRecordHighlight('리듬 보완', criteria[3].detail, window?.startAtMs ?? 0, window?.durationMs ?? 2200));
  }

  if (footSpacingStable) {
    const window = findLongestHighlightWindow(activeFrames, (analysis) => analysis.footSpacingState === 'balanced');
    strengths.push(buildRecordHighlight('발 간격 안정', criteria[4].detail, window?.startAtMs ?? 0, window?.durationMs ?? 2200));
  } else {
    const window = findLongestHighlightWindow(
      activeFrames,
      (analysis) => analysis.footSpacingState === 'narrow' || analysis.footSpacingState === 'wide'
    );
    improvements.push(buildRecordHighlight('발 간격 보완', criteria[4].detail, window?.startAtMs ?? 0, window?.durationMs ?? 2200));
  }

  return {
    level,
    summary: buildLessonRecordSummary(level, stableCount, criteria.length || 5),
    criteria,
    strengths,
    improvements,
  };
}

function buildSideDribbleRecordEvaluation(
  frames: TimedDribbleAnalysis[],
  latestAnalysis: DribbleAnalysis | null
): LessonRecordEvaluation {
  const activeFrames = frames.filter((frame) => frame.analysis.dribbleStarted);
  const torsoStableRatio = calculateStableRatio(activeFrames, (analysis) => analysis.torsoPosture === 'balanced');
  const heightAppropriateStableRatio = calculateStableRatio(activeFrames, (analysis) => analysis.dribbleHeight === 'balanced');
  const eyeStableRatio = calculateStableRatio(activeFrames, (analysis) => analysis.eyeFocus === 'forward');
  const torsoStable = torsoStableRatio >= 0.5;
  const heightAppropriateStable = heightAppropriateStableRatio >= 0.5;
  const eyeStable = eyeStableRatio >= 0.5;
  const rhythmStable = latestAnalysis?.dribbleRhythmState === 'good';
  const rhythmGoodRatio =
    latestAnalysis && typeof latestAnalysis.dribbleRhythmBadRatio === 'number'
      ? Math.max(0, 1 - latestAnalysis.dribbleRhythmBadRatio)
      : undefined;
  const criteria: LessonRecordCriterion[] = [
    {
      key: 'dribble-torso-posture',
      label: '상체 기울기',
      isStable: torsoStable,
      stableRatio: torsoStableRatio,
      detail: torsoStable
        ? `상체 기울기가 ${formatStableRatioText(torsoStableRatio)} 구간에서 안정적으로 유지되었습니다.`
        : `상체 기울기가 안정적이었던 구간은 ${formatStableRatioText(torsoStableRatio)}였습니다. 자세를 조금 더 일정하게 유지해 주세요.`,
    },
    {
      key: 'dribble-height-appropriate',
      label: '드리블 높이',
      isStable: heightAppropriateStable,
      stableRatio: heightAppropriateStableRatio,
      detail: heightAppropriateStable
        ? `드리블 높이가 ${formatStableRatioText(heightAppropriateStableRatio)} 구간에서 적절했습니다.`
        : `드리블 높이가 적절했던 구간은 ${formatStableRatioText(heightAppropriateStableRatio)}였습니다. 높이를 더 일정하게 맞춰 주세요.`,
    },
    {
      key: 'dribble-eye-focus',
      label: '시선 처리',
      isStable: eyeStable,
      stableRatio: eyeStableRatio,
      detail: eyeStable
        ? `시선이 ${formatStableRatioText(eyeStableRatio)} 구간에서 앞을 향했습니다.`
        : `시선이 앞을 본 구간은 ${formatStableRatioText(eyeStableRatio)}였습니다. 공보다 앞을 보는 시간을 더 늘려 주세요.`,
    },
    {
      key: 'dribble-rhythm',
      label: '드리블 리듬',
      isStable: rhythmStable,
      stableRatio: rhythmGoodRatio,
      detail: buildDribbleRhythmDetail(latestAnalysis, rhythmStable),
    },
  ];
  const stableCount = criteria.filter((criterion) => criterion.isStable).length;
  const level = buildLessonRecordLevel(stableCount, criteria.length || 3);
  const strengths: LessonRecordHighlight[] = [];
  const improvements: LessonRecordHighlight[] = [];

  if (torsoStable) {
    const window = findLongestHighlightWindow(activeFrames, (analysis) => analysis.torsoPosture === 'balanced');
    strengths.push(buildRecordHighlight('상체 기울기 안정', criteria[0].detail, window?.startAtMs ?? 0, window?.durationMs ?? 2200));
  } else {
    const window = findLongestHighlightWindow(
      activeFrames,
      (analysis) => analysis.torsoPosture === 'high' || analysis.torsoPosture === 'low'
    );
    improvements.push(buildRecordHighlight('상체 기울기 보완', criteria[0].detail, window?.startAtMs ?? 0, window?.durationMs ?? 2200));
  }

  if (heightAppropriateStable) {
    const window = findLongestHighlightWindow(activeFrames, (analysis) => analysis.dribbleHeight === 'balanced');
    strengths.push(buildRecordHighlight('드리블 높이 적절', criteria[1].detail, window?.startAtMs ?? 0, window?.durationMs ?? 2200));
  } else {
    const window = findLongestHighlightWindow(
      activeFrames,
      (analysis) => analysis.dribbleHeight === 'high' || analysis.dribbleHeight === 'low'
    );
    improvements.push(buildRecordHighlight('드리블 높이 조절', criteria[1].detail, window?.startAtMs ?? 0, window?.durationMs ?? 2200));
  }

  if (eyeStable) {
    const window = findLongestHighlightWindow(activeFrames, (analysis) => analysis.eyeFocus === 'forward');
    strengths.push(buildRecordHighlight('시선 처리 안정', criteria[2].detail, window?.startAtMs ?? 0, window?.durationMs ?? 2200));
  } else {
    const window = findLongestHighlightWindow(activeFrames, (analysis) => analysis.eyeFocus === 'ball');
    improvements.push(buildRecordHighlight('시선 처리 보완', criteria[2].detail, window?.startAtMs ?? 0, window?.durationMs ?? 2200));
  }

  if (rhythmStable) {
    const window = findLongestHighlightWindow(activeFrames, (analysis) => analysis.dribbleRhythmState === 'good');
    strengths.push(buildRecordHighlight('리듬 유지', criteria[3].detail, window?.startAtMs ?? 0, window?.durationMs ?? 2200));
  } else {
    const window = findLongestHighlightWindow(
      activeFrames,
      (analysis) => analysis.dribbleRhythmState === 'needs_improvement'
    );
    improvements.push(buildRecordHighlight('리듬 보완', criteria[3].detail, window?.startAtMs ?? 0, window?.durationMs ?? 2200));
  }

  return {
    level,
    summary: buildLessonRecordSummary(level, stableCount, criteria.length || 4),
    criteria,
    strengths,
    improvements,
  };
}

function buildDribbleRecordEvaluation(frames: TimedDribbleAnalysis[]): LessonRecordEvaluation {
  const latestActiveAnalysis = frames.filter((frame) => frame.analysis.dribbleStarted).at(-1)?.analysis ?? null;
  const latestAnalysis = latestActiveAnalysis ?? frames.at(-1)?.analysis ?? null;
  const dribbleView = latestAnalysis?.dribbleView ?? 'front';

  if (dribbleView === 'front') {
    return buildFrontDribbleRecordEvaluation(frames, latestAnalysis);
  }

  return buildSideDribbleRecordEvaluation(frames, latestAnalysis);
}

function buildDiarySkillInsight(
  selectedDateKey: string,
  shotGraphData: ShotGraphDatum[],
  dailyDribbleRecords: Record<string, number>,
  homeworkState: HomeworkStateRecord,
  lessonRecords: LessonRecord[]
): DiarySkillInsight {
  const selectedShotGraph = shotGraphData.find((item) => item.dateKey === selectedDateKey) ?? null;
  const selectedShotAttempts = selectedShotGraph?.attempts ?? 0;
  const selectedShotSuccesses = selectedShotGraph?.successes ?? 0;
  const selectedShotSuccessRate = selectedShotGraph?.successRate ?? 0;
  const selectedDateDribbleCount = selectedDateKey ? Math.max(0, dailyDribbleRecords[selectedDateKey] || 0) : 0;
  const todayDateKey = formatDateKey(new Date());
  const selectedHomeworkState = selectedDateKey ? homeworkState[selectedDateKey] ?? null : null;
  const selectedDateDribbleRecords = lessonRecords.filter(
    (record) => record.dateKey === selectedDateKey && record.mode === 'dribble'
  );
  const recordedLeftDribbleCount = selectedDateDribbleRecords.reduce(
    (sum, record) => sum + Math.max(0, record.leftHandDribbleCount ?? 0),
    0
  );
  const recordedRightDribbleCount = selectedDateDribbleRecords.reduce(
    (sum, record) => sum + Math.max(0, record.rightHandDribbleCount ?? 0),
    0
  );
  const shouldUseHomeworkHandTotals =
    selectedHomeworkState !== null &&
    (selectedDateKey === todayDateKey
      || selectedHomeworkState.handDribbleTotals.left > 0
      || selectedHomeworkState.handDribbleTotals.right > 0);
  const leftDribbleCount = shouldUseHomeworkHandTotals
    ? Math.max(0, selectedHomeworkState.handDribbleTotals.left)
    : recordedLeftDribbleCount;
  const rightDribbleCount = shouldUseHomeworkHandTotals
    ? Math.max(0, selectedHomeworkState.handDribbleTotals.right)
    : recordedRightDribbleCount;
  const dribbleBalanceGap = Math.abs(leftDribbleCount - rightDribbleCount);
  const dribbleTotal = leftDribbleCount + rightDribbleCount;
  const dribbleBalance =
    dribbleTotal === 0
      ? 'none'
      : dribbleBalanceGap <= 2
        ? 'balanced'
        : leftDribbleCount > rightDribbleCount
          ? 'left'
          : 'right';
  const evaluationCounts: Record<LessonRecordLevel, number> = {
    good: 0,
    average: 0,
    bad: 0,
  };

  for (const record of lessonRecords) {
    const level = record.dateKey === selectedDateKey ? record.evaluation?.level : null;

    if (level) {
      evaluationCounts[level] += 1;
    }
  }

  const dominantEvaluationLevel = getDominantCalendarLessonRecordLevel(evaluationCounts);
  const evaluationDominantLevel: DiarySkillInsight['evaluationDominantLevel'] =
    Object.values(evaluationCounts).every((count) => count <= 0)
      ? 'none'
      : !dominantEvaluationLevel
        ? 'mixed'
        : dominantEvaluationLevel;
  const shotAttemptsByDate = new Map(shotGraphData.map((item) => [item.dateKey, item.attempts]));
  const getDribbleCountForDate = (dateKey: string) => Math.max(0, dailyDribbleRecords[dateKey] || 0);
  const getShotAttemptsForDate = (dateKey: string) => Math.max(0, shotAttemptsByDate.get(dateKey) || 0);
  const getPracticeTotalForDate = (dateKey: string) =>
    getDribbleCountForDate(dateKey) + getShotAttemptsForDate(dateKey);
  const selectedDateTime = selectedDateKey ? parseDateKeyToTime(selectedDateKey) : 0;
  const selectedDate = selectedDateKey ? parseDateKeyToDate(selectedDateKey) : null;
  const yesterdayKey = selectedDate
    ? formatDateKey(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate() - 1))
    : '';
  const yesterdayDribbleCount = yesterdayKey ? getDribbleCountForDate(yesterdayKey) : 0;
  const yesterdayShotAttempts = yesterdayKey ? getShotAttemptsForDate(yesterdayKey) : 0;
  const previousPracticeDateKeys = Array.from(
    new Set([...Object.keys(dailyDribbleRecords), ...shotGraphData.map((item) => item.dateKey)])
  )
    .filter((dateKey) => dateKey !== selectedDateKey && parseDateKeyToTime(dateKey) < selectedDateTime && getPracticeTotalForDate(dateKey) > 0)
    .sort((left, right) => parseDateKeyToTime(right) - parseDateKeyToTime(left));
  const previousPracticeDateKey = previousPracticeDateKeys[0] ?? null;
  const previousPracticeDribbleCount = previousPracticeDateKey ? getDribbleCountForDate(previousPracticeDateKey) : 0;
  const previousPracticeShotAttempts = previousPracticeDateKey ? getShotAttemptsForDate(previousPracticeDateKey) : 0;
  const previousShotRecord = shotGraphData
    .filter((item) => item.dateKey !== selectedDateKey && parseDateKeyToTime(item.dateKey) < selectedDateTime && item.attempts > 0)
    .sort((left, right) => parseDateKeyToTime(right.dateKey) - parseDateKeyToTime(left.dateKey))[0] ?? null;
  const canShowDailySummary =
    selectedDateDribbleCount >= DAILY_DRIBBLE_TARGET && selectedShotAttempts >= DAILY_SHOOT_TARGET;

  return {
    selectedShotAttempts,
    selectedShotSuccesses,
    selectedShotSuccessRate,
    leftDribbleCount,
    rightDribbleCount,
    dribbleBalance,
    dribbleBalanceGap,
    canShowDailySummary,
    yesterdayDribbleCount,
    yesterdayShotAttempts,
    previousPracticeDateKey,
    previousPracticeDribbleCount,
    previousPracticeShotAttempts,
    previousShotDateKey: previousShotRecord?.dateKey ?? null,
    previousShotSuccessRate: previousShotRecord?.successRate ?? null,
    evaluationCounts,
    evaluationDominantLevel,
  };
}


function isPositiveFeedback(text: string) {
  const positiveKeywords = ['좋습니다', '좋아요', '안정적', '균형이 좋습니다', '타이밍이 좋습니다', '준비 자세가 좋습니다'];
  return positiveKeywords.some((keyword) => text.includes(keyword));
}

const REPRESENTATIVE_FEEDBACK_IGNORE_PATTERNS = [
  '분석하는 중입니다',
  '분석이 안정되면',
  '확인하는 중입니다',
  '정확히 확인되지 않았습니다',
  '카메라 대기 중',
  '보이도록',
];

function stripFeedbackLineNumber(line: string) {
  return line.replace(/^\d+\.\s*/, '').trim();
}

function isRecognitionIssueFeedbackLine(line: string) {
  const normalizedLine = stripFeedbackLineNumber(line);
  return REPRESENTATIVE_FEEDBACK_IGNORE_PATTERNS.some((pattern) => normalizedLine.includes(pattern));
}

function buildRepresentativeFeedbackText(text: string) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return '';
  }

  const titleLine = lines[0];
  const bodyLines = lines
    .slice(1)
    .map(stripFeedbackLineNumber)
    .filter(Boolean);
  const meaningfulBodyLines = bodyLines.filter((line) => !isRecognitionIssueFeedbackLine(line));

  if (meaningfulBodyLines.length === 0) {
    return '';
  }

  return [titleLine, ...meaningfulBodyLines.map((line, index) => `${index + 1}. ${line}`)].join('\n');
}

function buildRepresentativeFeedbackKey(text: string) {
  return text
    .replace(/\d+(?:\.\d+)?/g, '#')
    .replace(/\s+/g, ' ')
    .trim();
}

function selectRepresentativeFeedbackFromTimeline(timeline: FeedbackMoment[], fallbackFeedback: string) {
  const normalizedTimeline = timeline
    .map((item) => ({
      atMs: Number.isFinite(item.atMs) ? Math.max(0, item.atMs) : 0,
      text: item.text.trim(),
    }))
    .filter((item) => item.text);

  if (normalizedTimeline.length === 0) {
    return fallbackFeedback.trim();
  }

  const buckets = new Map<string, { text: string; count: number; totalDurationMs: number; firstAtMs: number }>();
  const defaultTailDurationMs =
    normalizedTimeline.length > 1
      ? Math.max(500, normalizedTimeline[normalizedTimeline.length - 1].atMs - normalizedTimeline[normalizedTimeline.length - 2].atMs)
      : 1000;
  const timelineEndAtMs = normalizedTimeline[normalizedTimeline.length - 1].atMs + defaultTailDurationMs;

  normalizedTimeline.forEach((item, index) => {
    const representativeText = buildRepresentativeFeedbackText(item.text);

    if (!representativeText) {
      return;
    }

    const key = buildRepresentativeFeedbackKey(representativeText);

    if (!key) {
      return;
    }

    const nextAtMs = normalizedTimeline[index + 1]?.atMs ?? timelineEndAtMs;
    const durationMs = Math.max(1, nextAtMs - item.atMs);
    const bucket = buckets.get(key);

    if (bucket) {
      bucket.count += 1;
      bucket.totalDurationMs += durationMs;
      return;
    }

    buckets.set(key, {
      text: representativeText,
      count: 1,
      totalDurationMs: durationMs,
      firstAtMs: item.atMs,
    });
  });

  const selected = [...buckets.values()].sort((left, right) => {
    if (right.totalDurationMs !== left.totalDurationMs) {
      return right.totalDurationMs - left.totalDurationMs;
    }

    if (right.count !== left.count) {
      return right.count - left.count;
    }

    return left.firstAtMs - right.firstAtMs;
  })[0];

  if (selected?.text) {
    return selected.text;
  }

  return fallbackFeedback.trim();
}

function scoreFeedbackText(text: string) {
  let score = 0;
  const strongKeywords = ['낮습니다', '높습니다', '부족', '급하게', '빠르게', '느리게', '늦습니다', '다시 맞춰', '벌려', '모아'];
  const mediumKeywords = ['확인 중', '조금 더', '유지', '안정적', '준비 자세'];

  if (strongKeywords.some((keyword) => text.includes(keyword))) {
    score += 3;
  }

  if (mediumKeywords.some((keyword) => text.includes(keyword))) {
    score += 1;
  }

  if (isPositiveFeedback(text)) {
    score -= 2;
  }

  return score;
}

function buildReviewClipFromTimeline(
  timeline: FeedbackMoment[],
  fallbackFeedback: string,
  videoUri: string
): LessonReviewClip {
  const buckets = new Map<string, { text: string; score: number; count: number; firstAtMs: number }>();

  for (const item of timeline) {
    const text = item.text.trim();
    if (!text) {
      continue;
    }

    const weight = Math.max(0, scoreFeedbackText(text));
    const bucket = buckets.get(text);

    if (bucket) {
      bucket.count += 1;
      bucket.score += Math.max(1, weight);
      continue;
    }

    buckets.set(text, {
      text,
      score: Math.max(1, weight),
      count: 1,
      firstAtMs: item.atMs,
    });
  }

  const candidates = [...buckets.values()]
    .filter((item) => !isPositiveFeedback(item.text))
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      if (right.count !== left.count) {
        return right.count - left.count;
      }

      return left.firstAtMs - right.firstAtMs;
    });

  const fallbackEntry = timeline[timeline.length - 1] ?? { atMs: 0, text: fallbackFeedback };
  const selected = candidates[0] ?? {
    text: fallbackEntry.text || fallbackFeedback,
    score: 1,
    count: 1,
    firstAtMs: fallbackEntry.atMs,
  };

  const totalDuration = timeline[timeline.length - 1]?.atMs ?? 0;
  const maxStartAt = Math.max(0, totalDuration - 3000);
  const startAtMs = Math.max(0, Math.min(selected.firstAtMs, maxStartAt));

  return {
    videoUri,
    feedback: selected.text || fallbackFeedback,
    startAtMs,
    durationMs: 3000,
    title: '문제가 많았던 3초',
  };
}

function buildShootReviewFeedback(analysis: ShootAnalysis | null) {
  if (!analysis) {
    return '슛 촬영 분석 결과\n1. 자세를 충분히 확인하지 못했습니다. 전신과 공이 함께 보이도록 다시 촬영해 주세요.\n2. 다리 각도와 타이밍을 다시 확인할 수 있도록 조금 더 선명하게 촬영해 주세요.';
  }

  const legAngleText = analysis.lowestLegAngle !== null ? `${analysis.lowestLegAngle.toFixed(1)}도` : '--';
  const releaseDurationText = formatReleaseDurationSeconds(analysis.releaseDurationMs);
  const legLine =
    analysis.legAngleState === 'low'
      ? `1. 준비 자세의 다리 각도가 ${legAngleText}로 낮습니다. 무릎을 조금 더 사용해 점프해 주세요.`
      : analysis.legAngleState === 'high'
        ? `1. 준비 자세의 다리 각도가 ${legAngleText}로 높습니다. 자세를 조금 더 편안하게 낮춰 주세요.`
        : analysis.legAngleState === 'balanced'
          ? `1. 준비 자세의 다리 각도가 ${legAngleText}로 안정적입니다.`
          : '1. 다리 각도를 충분히 확인하지 못했습니다. 전신이 보이도록 다시 촬영해 주세요.';

  const timingLine =
    analysis.releaseTiming === 'early'
      ? '2. 릴리스가 조금 빠른 편입니다. 몸이 올라오는 흐름과 함께 손을 뻗어 주세요.'
      : analysis.releaseTiming === 'late'
        ? '2. 릴리스가 조금 늦습니다. 최고점에 가까워질 때 공을 놓아 주세요.'
        : analysis.releaseTiming === 'balanced'
          ? '2. 릴리스 타이밍이 안정적입니다.'
          : '2. 릴리스 타이밍을 충분히 확인하지 못했습니다. 공과 손목이 보이도록 다시 촬영해 주세요.';

  const releasePointLine =
    analysis.releasePointState === 'high'
      ? '3. 릴리스 높이가 좋습니다. 지금처럼 머리 위쪽에서 공을 놓아 주세요.'
      : analysis.releasePointState === 'low'
        ? '3. 릴리스 높이가 낮습니다. 공을 조금 더 높게 뻗어 주세요.'
        : '3. 릴리스 높이를 충분히 확인하지 못했습니다. 머리와 공이 함께 보이도록 다시 촬영해 주세요.';

  const releaseDurationLine =
    analysis.releaseDurationState === 'balanced'
      ? `4. 릴리스까지 걸린 시간은 ${releaseDurationText}로 안정적입니다.`
      : analysis.releaseDurationState === 'slow'
        ? `4. 릴리스까지 ${releaseDurationText}가 걸렸습니다. 손목 스냅을 조금 더 빠르게 가져가 주세요.`
        : '4. 릴리스 시간을 충분히 확인하지 못했습니다. 동작이 끊기지 않게 다시 촬영해 주세요.';

  return `슛 촬영 분석 결과\n${legLine}\n${timingLine}\n${releasePointLine}\n${releaseDurationLine}`;
}

function isDribbleStanceReady(analysis: DribbleAnalysis) {
  if (analysis.bodyFacing === 'front') {
    return analysis.stanceState === 'ready';
  }

  return (
    analysis.stanceState === 'ready' ||
    ((!analysis.stanceState || analysis.stanceState === 'unknown') &&
      analysis.eyeFocus === 'forward' &&
      analysis.torsoPosture === 'balanced')
  );
}

function isDribbleStanceReadyForView(analysis: DribbleAnalysis, expectedView: DribbleLessonView) {
  if (expectedView === 'front') {
    return analysis.frontStanceAngle !== null && analysis.frontStanceAngle >= 140 && analysis.frontStanceAngle <= 170;
  }

  if (analysis.bodyFacing !== 'side') {
    return false;
  }

  return (
    analysis.stanceState === 'ready' ||
    ((!analysis.stanceState || analysis.stanceState === 'unknown') &&
      analysis.eyeFocus === 'forward' &&
      analysis.torsoPosture === 'balanced')
  );
}

function buildDribbleStanceFeedback(analysis: DribbleAnalysis) {
  const eyeLine =
    analysis.eyeFocus === 'forward'
      ? '시선이 좋습니다. 지금처럼 공보다 앞을 바라봐 주세요.'
      : '시선이 공 쪽으로 내려가 있습니다. 공보다 앞을 보고 드리블해 주세요.';

  const torsoLine =
    analysis.torsoPosture === 'balanced'
      ? '상체 자세가 안정적입니다. 지금 자세를 유지해 주세요.'
      : analysis.torsoPosture === 'high'
        ? '상체가 조금 높습니다. 무릎을 더 써서 자세를 낮춰 주세요.'
        : analysis.torsoPosture === 'low'
          ? '상체가 너무 숙여졌습니다. 조금만 세워서 균형을 맞춰 주세요.'
          : '어깨와 엉덩이가 보이도록 자세를 다시 맞춰 주세요.';

  return `드리블 준비 자세\n1. ${eyeLine}\n2. 시선과 상체 자세가 모두 맞으면 3초 뒤 드리블을 시작합니다.\n3. ${torsoLine}`;
}

function isShootStanceReady(analysis: ShootAnalysis) {
  return analysis.readyPoseDetected;
}

function buildDribbleStanceFeedbackV2(analysis: DribbleAnalysis) {
  const torsoLine =
    analysis.stanceState === 'ready'
      ? `상체 기울기가 ${analysis.torsoLeanAngle ? analysis.torsoLeanAngle.toFixed(1) : '--'}도로 준비 자세가 좋습니다.`
      : analysis.stanceState === 'too_upright'
        ? `상체 기울기가 ${analysis.torsoLeanAngle ? analysis.torsoLeanAngle.toFixed(1) : '--'}도로 높습니다. 조금 더 숙여 주세요.`
        : analysis.stanceState === 'too_low'
          ? `상체 기울기가 ${analysis.torsoLeanAngle ? analysis.torsoLeanAngle.toFixed(1) : '--'}도로 너무 낮습니다. 조금만 세워 주세요.`
          : '어깨와 엉덩이가 보이도록 상체 각도를 다시 맞춰 주세요.';

  return `드리블 준비 자세\n1. 어깨부터 무릎까지 상체 기울기를 40~80도로 맞춰 주세요.\n2. 이 자세를 3초 동안 유지하면 드리블을 시작하라고 알려 드립니다.\n3. ${torsoLine}`;
}

function buildDribbleStanceFeedbackV3(analysis: DribbleAnalysis) {
  if (analysis.frontStanceAngle === null) {
    return '정면 드리블 준비 자세\n1. 발, 무릎, 엉덩이가 화면에 보이도록 서 주세요.\n2. 무릎 각도를 140~170도로 맞추면 3초 카운트가 시작됩니다.\n3. 하체가 보이도록 자세를 다시 맞춰 주세요.';
  }

  const stanceLine =
    analysis.frontStanceAngle >= 140 && analysis.frontStanceAngle <= 170
      ? `무릎 각도 ${analysis.frontStanceAngle.toFixed(1)}도로 준비 자세가 안정적입니다.`
      : `무릎 각도가 ${analysis.frontStanceAngle.toFixed(1)}도입니다. 140~170도에 가깝게 다시 맞춰 주세요.`;

  return `정면 드리블 준비 자세\n1. 자세를 낮춰 무릎 각도를 140~170도로 맞춰 주세요.\n2. 이 자세를 3초 동안 유지하면 드리블을 시작하라고 알려 드립니다.\n3. ${stanceLine}`;
}

function buildDribbleStanceFeedbackForView(analysis: DribbleAnalysis, expectedView: DribbleLessonView) {
  if (expectedView === 'front') {
    return buildDribbleStanceFeedbackV3(analysis);
  }

  if (analysis.bodyFacing === 'front') {
    return '옆모습 드리블 준비 자세\n1. 몸이 옆으로 보이게 돌아서 주세요.\n2. 어깨와 엉덩이가 화면에 보이도록 맞춰 주세요.\n3. 옆모습이 확인되면 3초 카운트 뒤 드리블을 시작합니다.';
  }

  return buildDribbleStanceFeedbackV2(analysis);
}

function buildShootStanceFeedback(analysis: ShootAnalysis) {
  const armLine =
    analysis.armAngleState === 'balanced'
      ? '팔 각도가 좋습니다. 지금 자세를 유지해 주세요.'
      : analysis.armAngleState === 'narrow'
        ? '팔 각도가 좁습니다. 팔을 조금 더 벌려 주세요.'
        : analysis.armAngleState === 'wide'
          ? '팔 각도가 넓습니다. 팔을 조금 더 모아 주세요.'
          : '어깨와 팔꿈치, 손목이 보이도록 준비 자세를 다시 맞춰 주세요.';

  return `슛 준비 자세\n1. ${armLine}\n2. 팔 각도가 기준에 맞으면 3초 카운트 후 슛 분석을 시작합니다.\n3. 준비 자세가 무너지면 다시 자세부터 맞춥니다.`;
}

function createFrontDribbleCriterionCounter(): Record<FrontDribbleCriterionNumber, number> {
  return {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
  };
}

function buildFrontCriterionFeedback(
  criterionNumber: FrontDribbleCriterionNumber,
  analysis: DribbleAnalysis
) {
  switch (criterionNumber) {
    case 1:
      return `발-무릎-엉덩이 각도가 ${analysis.frontStanceAngle ? analysis.frontStanceAngle.toFixed(1) : '--'}도입니다. 140~170도에 가깝게 자세를 다시 맞춰 주세요.`;
    case 2:
      return '공이 다리 사이로 들어가 있습니다. 공을 몸 바깥쪽 라인에서 드리블해 주세요.';
    case 3:
      return `왼손 ${analysis.leftHandDribbleCount}번, 오른손 ${analysis.rightHandDribbleCount}번으로 차이가 있습니다. 양손 균형을 맞춰 주세요.`;
    case 4:
      if (analysis.footSpacingState === 'narrow') {
        return '발 간격이 어깨보다 좁습니다. 조금 더 벌려 주세요.';
      }

      return '발 간격이 너무 넓습니다. 조금만 좁혀 주세요.';
    default:
      return '자세를 다시 맞춰 주세요.';
  }
}

function buildFrontWeakPointSummary(frontWeakPoint: FrontDribbleWeakPoint) {
  return `가장 보완이 필요한 기준은 ${frontWeakPoint.criterionNumber}번입니다. ${frontWeakPoint.feedbackText}`;
}

export function useBasketballCoachApp() {
  const [screen, setScreen] = useState<AppScreen>('home');
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [accounts, setAccounts] = useState<UserAccount[]>([]);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isAccountDataReady, setIsAccountDataReady] = useState(false);
  const [lessonMode, setLessonMode] = useState<LessonMode>('dribble');
  const [attendance, setAttendance] = useState<Record<string, string>>({});
  const [dailyDribbleRecords, setDailyDribbleRecords] = useState<Record<string, number>>({});
  const [homeworkState, setHomeworkState] = useState<HomeworkStateRecord>({});
  const [lessonRecords, setLessonRecords] = useState<LessonRecord[]>([]);
  const [shotAttemptRecords, setShotAttemptRecords] = useState<Record<string, number>>({});
  const [shotSuccessRecords, setShotSuccessRecords] = useState<Record<string, number>>({});
  const [selectedDateKey, setSelectedDateKey] = useState('');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedSkillKey, setSelectedSkillKey] = useState<SkillKey | ''>('');
  const [selectedBallBrand, setSelectedBallBrand] = useState<BallBrandOption>(DEFAULT_BALL_BRAND);
  const [selectedBallColors, setSelectedBallColors] = useState<BallColorOption[]>(DEFAULT_BALL_COLORS);
  const [ballRecognitionProfile, setBallRecognitionProfile] = useState<BallRecognitionProfile | null>(null);
  const [ballRecognitionPreviews, setBallRecognitionPreviews] = useState<BallRecognitionPreview[]>([]);
  const [ballRecognitionCalibrationJob, setBallRecognitionCalibrationJob] = useState<BallRecognitionCalibrationJob | null>(null);
  const [isBallRecognitionTraining, setIsBallRecognitionTraining] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState<PositionOption>(DEFAULT_POSITION);
  const [debugText, setDebugText] = useState(DEFAULT_DEBUG_TEXT);
  const [feedbackText, setFeedbackText] = useState(DEFAULT_DRIBBLE_FEEDBACK);
  const [lessonReview, setLessonReview] = useState<LessonReviewClip | null>(null);
  const [selectedDribbleView, setSelectedDribbleView] = useState<DribbleLessonView>('front');
  const [currentDribbleCount, setCurrentDribbleCount] = useState(0);
  const [isLessonActive, setIsLessonActive] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isCameraPreviewHidden, setIsCameraPreviewHidden] = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [cameraSessionKey, setCameraSessionKey] = useState(0);
  const [countdownValue, setCountdownValue] = useState<number | null>(null);
  const [dribbleResetToken, setDribbleResetToken] = useState(0);
  const [shootResetToken, setShootResetToken] = useState(0);
  const [recordingStartToken, setRecordingStartToken] = useState(0);
  const [recordingStopToken, setRecordingStopToken] = useState(0);
  const [cameraStopMode, setCameraStopMode] = useState<CameraStopMode>(null);
  const [fireworks, setFireworks] = useState<FireworkItem[]>([]);
  const [showFireworks, setShowFireworks] = useState(false);
  const [startupStatusText, setStartupStatusText] = useState('앱을 준비하고 있습니다.');
  const [isShootSuccessButtonVisible, setIsShootSuccessButtonVisible] = useState(false);

  const feedbackIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingFeedbackRef = useRef<string | null>(null);
  const latestFeedbackRef = useRef(feedbackText);
  const lessonModeRef = useRef(lessonMode);
  const selectedDribbleViewRef = useRef<DribbleLessonView>(selectedDribbleView);
  const lessonStartedAtRef = useRef<number | null>(null);
  const dribbleLessonPhaseRef = useRef<DribbleLessonPhase>('stance_setup');
  const shootLessonStartedRef = useRef(false);
  const shootCooldownUntilRef = useRef<number | null>(null);
  const shootRecordingStartedRef = useRef(false);
  const dribbleTargetCountRef = useRef<number | null>(null);
  const dribbleAutoEndingRef = useRef(false);
  const lessonCompletionCuePlayedRef = useRef(false);
  const stanceCountdownStartedAtRef = useRef<number | null>(null);
  const feedbackTimelineRef = useRef<FeedbackMoment[]>([]);
  const pendingStopSaveRef = useRef(false);
  const recordingFallbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shootAutoEndTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingReviewStopRef = useRef(false);
  const pendingShootReviewRef = useRef(false);
  const pendingShootRecordingStopRef = useRef(false);
  const startCueSoundRef = useRef<Audio.Sound | null>(null);
  const countdownCueSoundRef = useRef<Audio.Sound | null>(null);
  const countdownCueUriRef = useRef<string | null>(null);
  const lastCountdownCueValueRef = useRef<number | null>(null);
  const webStartCueContextRef = useRef<any>(null);
  const latestDribbleAnalysisRef = useRef<DribbleAnalysis | null>(null);
  const latestShootAnalysisRef = useRef<ShootAnalysis | null>(null);
  const dribbleAnalysisFramesRef = useRef<TimedDribbleAnalysis[]>([]);
  const completedDribbleCountRef = useRef(0);
  const dailyDribbleRecordsRef = useRef<Record<string, number>>({});
  const homeworkStateRef = useRef<HomeworkStateRecord>({});
  const lessonRecordsRef = useRef<LessonRecord[]>([]);
  const shotAttemptRecordsRef = useRef<Record<string, number>>({});
  const shootAnalysisHistoryRef = useRef<ShootAnalysis[]>([]);
  const shootAnalysisFramesRef = useRef<TimedShootAnalysis[]>([]);
  const shootFeedbackLockedRef = useRef(false);
  const frontDribbleCriterionCountsRef = useRef<Record<FrontDribbleCriterionNumber, number>>(createFrontDribbleCriterionCounter());
  const frontDribbleWeakPointRef = useRef<FrontDribbleWeakPoint | null>(null);
  const frontDribbleSummaryShownRef = useRef(false);
  const shotSuccessRecordsRef = useRef<Record<string, number>>({});
  const shootSuccessRecordedForCurrentAttemptRef = useRef(false);
  const startupRecoveryTriggeredRef = useRef(false);
  const seededDevTestUsersRef = useRef<Set<string>>(new Set());
  const remoteTokenRef = useRef<string | null>(null);
  const lastRemoteSnapshotRef = useRef('');
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  const currentUserId = currentUser?.id ?? '';
  const isReady = isAuthReady && (!currentUser || isAccountDataReady);

  function getCumulativeDribbleCount(roundDribbleCount: number) {
    return completedDribbleCountRef.current + Math.max(0, Math.trunc(roundDribbleCount));
  }

  function buildCumulativeDribbleAnalysis(analysis: DribbleAnalysis): DribbleAnalysis {
    return {
      ...analysis,
      dribbleCount: getCumulativeDribbleCount(analysis.dribbleCount),
    };
  }
  const selectedSkill = selectedSkillKey ? SKILLS[selectedSkillKey] : null;
  const todayKey = formatDateKey(new Date());
  const todayDribbleCount = dailyDribbleRecords[todayKey] || 0;
  const todayShootAttemptCount = shotAttemptRecords[todayKey] || 0;
  const todayShotSuccessCount = shotSuccessRecords[todayKey] || 0;
  const todayHomeworkState = useMemo(() => getDailyHomeworkState(homeworkState, todayKey), [homeworkState, todayKey]);
  const remoteSnapshot = useMemo(
    () =>
      buildRemoteSnapshot({
        attendance,
        lessonRecords,
        dribbleCounts: dailyDribbleRecords,
        shotAttempts: shotAttemptRecords,
        shotSuccess: shotSuccessRecords,
        ballColors: selectedBallColors,
        ballBrand: selectedBallBrand,
        ballRecognitionProfile,
        position: selectedPosition,
        homework: homeworkState,
      }),
    [
      attendance,
      dailyDribbleRecords,
      homeworkState,
      lessonRecords,
      selectedBallBrand,
      selectedBallColors,
      ballRecognitionProfile,
      selectedPosition,
      shotAttemptRecords,
      shotSuccessRecords,
    ]
  );
  const remoteSnapshotText = useMemo(() => JSON.stringify(remoteSnapshot), [remoteSnapshot]);
  const todayLessonCount = useMemo(
    () => lessonRecords.filter((record) => record.dateKey === todayKey).length,
    [lessonRecords, todayKey]
  );
  const homeworkTestState = useMemo<HomeworkTestState>(() => {
    const correctionTask = todayHomeworkState.correctionTask;
    const correctionDirection = correctionTask?.direction ?? 'none';
    const correctionProgress =
      correctionTask?.direction === 'left'
        ? Math.max(0, todayHomeworkState.handDribbleTotals.left - correctionTask.baselineCount)
        : correctionTask?.direction === 'right'
          ? Math.max(0, todayHomeworkState.handDribbleTotals.right - correctionTask.baselineCount)
          : 0;

    return {
      dribbleCount: todayDribbleCount,
      shootAttemptCount: todayShootAttemptCount,
      shotSuccessCount: todayShotSuccessCount,
      skillVideoOpenCount: todayHomeworkState.skillVideoEvents.length,
      leftHandTotal: todayHomeworkState.handDribbleTotals.left,
      rightHandTotal: todayHomeworkState.handDribbleTotals.right,
      isStage2Unlocked: Boolean(todayHomeworkState.stage2Unlock),
      correctionDirection,
      correctionProgress,
    };
  }, [todayDribbleCount, todayHomeworkState, todayShootAttemptCount, todayShotSuccessCount]);
  const homeworkToShow = useMemo<HomeworkProgressItem[]>(
    () =>
      buildDailyHomeworkProgress({
        dateKey: todayKey,
        dailyDribbleCount: todayDribbleCount,
        shootAttemptCount: todayShootAttemptCount,
        shotSuccessCount: todayShotSuccessCount,
        lessonRecords,
        dailyState: todayHomeworkState,
      }),
    [
      lessonRecords,
      todayDribbleCount,
      todayHomeworkState,
      todayKey,
      todayShootAttemptCount,
      todayShotSuccessCount,
    ]
  );
  const calendarRecordLevels = useMemo(() => {
    const levelCountsByDate: Record<string, Record<LessonRecordLevel, number>> = {};

    for (const record of lessonRecords) {
      const level = record.evaluation?.level;

      if (!level) {
        continue;
      }

      if (!levelCountsByDate[record.dateKey]) {
        levelCountsByDate[record.dateKey] = {
          good: 0,
          average: 0,
          bad: 0,
        };
      }

      levelCountsByDate[record.dateKey][level] += 1;
    }

    const dominantLevelsByDate: Record<string, LessonRecordLevel> = {};

    for (const [dateKey, counts] of Object.entries(levelCountsByDate)) {
      const dominantLevel = getDominantCalendarLessonRecordLevel(counts);

      if (!dominantLevel) {
        continue;
      }

      dominantLevelsByDate[dateKey] = dominantLevel;
    }

    return dominantLevelsByDate;
  }, [lessonRecords]);
  const calendarCells = useMemo(
    () => getCalendarCells(currentDate, calendarRecordLevels),
    [calendarRecordLevels, currentDate]
  );
  const selectedDateRecords = useMemo(
    () => lessonRecords.filter((record) => record.dateKey === selectedDateKey).slice().reverse(),
    [lessonRecords, selectedDateKey]
  );
  const selectedDateDribbleCount = selectedDateKey ? dailyDribbleRecords[selectedDateKey] || 0 : 0;
  const shotGraphData = useMemo<ShotGraphDatum[]>(() => {
    const allDateKeys = Array.from(
      new Set([...Object.keys(shotAttemptRecords), ...Object.keys(shotSuccessRecords)])
    ).sort((left, right) => parseDateKeyToTime(left) - parseDateKeyToTime(right));

    return allDateKeys.map((dateKey) => {
      const attempts = shotAttemptRecords[dateKey] || 0;
      const successes = shotSuccessRecords[dateKey] || 0;
      const successRate = attempts > 0 ? Math.min(100, Math.round((successes / attempts) * 100)) : 0;

      return {
        dateKey,
        attempts,
        successes,
        successRate,
      };
    });
  }, [shotAttemptRecords, shotSuccessRecords]);
  const diarySkillInsight = useMemo(
    () => buildDiarySkillInsight(selectedDateKey, shotGraphData, dailyDribbleRecords, homeworkState, lessonRecords),
    [dailyDribbleRecords, homeworkState, lessonRecords, selectedDateKey, shotGraphData]
  );

  const persistScopedAccountValue = useCallback(
    (scopedKey: keyof ReturnType<typeof getAccountStorageKeys>, value: unknown) => {
      if (!currentUserId || !isAccountDataReady) {
        return;
      }

      const scopedKeys = getAccountStorageKeys(currentUserId);
      void AppStorage.setItem(scopedKeys[scopedKey], JSON.stringify(value));
    },
    [currentUserId, isAccountDataReady]
  );

  const persistLessonRecords = useCallback(
    (records: LessonRecord[]) => {
      if (!currentUserId || !isAccountDataReady) {
        return;
      }

      const scopedKeys = getAccountStorageKeys(currentUserId);
      void setLessonRecordEntries(buildStoredLessonRecordEntries(scopedKeys, records));
    },
    [currentUserId, isAccountDataReady]
  );

  const resetAccountState = useCallback(() => {
    const resetDate = new Date();
    const resetDateKey = formatDateKey(resetDate);

    setScreen('home');
    setLessonMode('dribble');
    setAttendance({});
    setDailyDribbleRecords({});
    setHomeworkState({});
    setLessonRecords([]);
    setShotAttemptRecords({});
    setShotSuccessRecords({});
    setSelectedDateKey(resetDateKey);
    setCurrentDate(resetDate);
    setSelectedSkillKey('');
    setSelectedBallBrand(DEFAULT_BALL_BRAND);
    setSelectedBallColors(DEFAULT_BALL_COLORS);
    setBallRecognitionProfile(null);
    setBallRecognitionPreviews([]);
      setBallRecognitionCalibrationJob(null);
      setIsBallRecognitionTraining(false);
      setSelectedPosition(DEFAULT_POSITION);
      setDebugText(DEFAULT_DEBUG_TEXT);
    setFeedbackText(DEFAULT_DRIBBLE_FEEDBACK);
    setLessonReview(null);
    setSelectedDribbleView('front');
    completedDribbleCountRef.current = 0;
    setCurrentDribbleCount(0);
    setIsLessonActive(false);
    setIsCameraActive(false);
    setIsCameraReady(false);
    setCameraError('');
    setCameraSessionKey(0);
    setCountdownValue(null);
    setDribbleResetToken(0);
    setShootResetToken(0);
    setRecordingStartToken(0);
    setRecordingStopToken(0);
    setCameraStopMode(null);
    setFireworks([]);
    setShowFireworks(false);
    setStartupStatusText('앱을 준비하고 있습니다.');
    setIsShootSuccessButtonVisible(false);

    latestFeedbackRef.current = DEFAULT_DRIBBLE_FEEDBACK;
    pendingFeedbackRef.current = null;
    lessonModeRef.current = 'dribble';
    selectedDribbleViewRef.current = 'front';
    lessonStartedAtRef.current = null;
    dribbleLessonPhaseRef.current = 'stance_setup';
    shootLessonStartedRef.current = false;
    shootCooldownUntilRef.current = null;
    shootRecordingStartedRef.current = false;
    dribbleTargetCountRef.current = null;
    dribbleAutoEndingRef.current = false;
    lessonCompletionCuePlayedRef.current = false;
    stanceCountdownStartedAtRef.current = null;
    feedbackTimelineRef.current = [];
    pendingStopSaveRef.current = false;
    pendingReviewStopRef.current = false;
    pendingShootReviewRef.current = false;
    pendingShootRecordingStopRef.current = false;
    latestDribbleAnalysisRef.current = null;
    latestShootAnalysisRef.current = null;
    dribbleAnalysisFramesRef.current = [];
    dailyDribbleRecordsRef.current = {};
    homeworkStateRef.current = {};
    lessonRecordsRef.current = [];
    shotAttemptRecordsRef.current = {};
    shotSuccessRecordsRef.current = {};
    shootSuccessRecordedForCurrentAttemptRef.current = false;
    shootAnalysisHistoryRef.current = [];
    shootAnalysisFramesRef.current = [];
    shootFeedbackLockedRef.current = false;
    frontDribbleCriterionCountsRef.current = createFrontDribbleCriterionCounter();
    frontDribbleWeakPointRef.current = null;
    frontDribbleSummaryShownRef.current = false;
    lastCountdownCueValueRef.current = null;
  }, []);

  const persistSession = useCallback(async (userId: string, keepSignedIn: boolean, remoteToken?: string | null) => {
    remoteTokenRef.current = remoteToken ?? null;

    if (keepSignedIn) {
      const nextSession: AuthSession = { userId, remoteToken: remoteToken ?? null };
      await AppStorage.setItem(STORAGE_KEYS.session, JSON.stringify(nextSession));
      return;
    }

    await AppStorage.removeItem(STORAGE_KEYS.session);
  }, []);

  const activateRemoteAccount = useCallback(
    async ({
      account,
      keepSignedIn,
      snapshot,
      token,
      baseAccounts,
    }: {
      account: UserAccount;
      keepSignedIn: boolean;
      snapshot?: RemoteAccountSnapshot;
      token: string;
      baseAccounts?: UserAccount[];
    }) => {
      const nextAccount = buildCachedAccount(account);
      const nextSnapshot = normalizeAccountSnapshot(snapshot ?? createEmptyRemoteSnapshot());
      const nextAccounts = mergeCachedAccounts(baseAccounts ?? accounts, nextAccount);

      await AppStorage.setItem(STORAGE_KEYS.accounts, JSON.stringify(nextAccounts));
      const storedSnapshot = await writeStoredAccountSnapshot(nextAccount.id, nextSnapshot);
      lastRemoteSnapshotRef.current = JSON.stringify(buildRemoteSnapshot(storedSnapshot));
      await persistSession(nextAccount.id, keepSignedIn, token);
      setAccounts(nextAccounts);
      setCurrentUser(toAuthUser(nextAccount));
      setAuthMode('login');

      return {
        nextAccount,
        nextAccounts,
      };
    },
    [accounts, persistSession]
  );

  const applyAccountSnapshot = useCallback((snapshot: RemoteAccountSnapshot) => {
    const nextSnapshot = normalizeAccountSnapshot(snapshot);
    const nextTodayKey = formatDateKey(new Date());
    const nextAttendance = {
      ...nextSnapshot.attendance,
      [nextTodayKey]: 'attended',
    };
    const nextBallBrand = isBallBrandOption(nextSnapshot.ballBrand) ? nextSnapshot.ballBrand : DEFAULT_BALL_BRAND;
    const nextBallColors =
      nextSnapshot.ballColors.length > 0
        ? nextSnapshot.ballColors
        : BALL_BRAND_PRESETS[nextBallBrand] ?? DEFAULT_BALL_COLORS;
    const nextBallRecognitionProfile = sanitizeBallRecognitionProfile(nextSnapshot.ballRecognitionProfile);
    const nextPosition = isPositionOption(nextSnapshot.position) ? nextSnapshot.position : DEFAULT_POSITION;

    dailyDribbleRecordsRef.current = nextSnapshot.dribbleCounts;
    homeworkStateRef.current = nextSnapshot.homework;
    lessonRecordsRef.current = nextSnapshot.lessonRecords;
    shotAttemptRecordsRef.current = nextSnapshot.shotAttempts;
    shotSuccessRecordsRef.current = nextSnapshot.shotSuccess;
    setAttendance(nextAttendance);
    setDailyDribbleRecords(nextSnapshot.dribbleCounts);
    setHomeworkState(nextSnapshot.homework);
    setLessonRecords(nextSnapshot.lessonRecords);
    setShotAttemptRecords(nextSnapshot.shotAttempts);
    setShotSuccessRecords(nextSnapshot.shotSuccess);
    setSelectedBallBrand(nextBallBrand);
    setSelectedBallColors(nextBallColors);
    setBallRecognitionProfile(nextBallRecognitionProfile);
    setSelectedPosition(nextPosition);
    setSelectedDateKey(nextTodayKey);
    setCurrentDate(new Date());

    return {
      nextAttendance,
      nextSnapshot,
    };
  }, []);

  const recoverStartupToLogin = useCallback(async () => {
    startupRecoveryTriggeredRef.current = true;
    remoteTokenRef.current = null;

    try {
      await AppStorage.removeItem(STORAGE_KEYS.session);
    } catch {
      // Ignore session cleanup failures and continue to the login screen.
    }

    resetAccountState();
    setCurrentUser(null);
    setIsAuthReady(true);
    setIsAccountDataReady(false);
    setAuthMode('login');
    setStartupStatusText('로그인 화면을 준비하고 있습니다.');
  }, [resetAccountState]);

  useEffect(() => {
    latestFeedbackRef.current = feedbackText;
  }, [feedbackText]);

  useEffect(() => {
    dailyDribbleRecordsRef.current = dailyDribbleRecords;
  }, [dailyDribbleRecords]);

  useEffect(() => {
    homeworkStateRef.current = homeworkState;
  }, [homeworkState]);

  useEffect(() => {
    lessonRecordsRef.current = lessonRecords;
  }, [lessonRecords]);

  useEffect(() => {
    shotAttemptRecordsRef.current = shotAttemptRecords;
  }, [shotAttemptRecords]);

  useEffect(() => {
    shotSuccessRecordsRef.current = shotSuccessRecords;
  }, [shotSuccessRecords]);

  useEffect(() => {
    lessonModeRef.current = lessonMode;
  }, [lessonMode]);

  useEffect(() => {
    selectedDribbleViewRef.current = selectedDribbleView;
  }, [selectedDribbleView]);

  useEffect(() => {
    let isMounted = true;

    async function loadAuthState() {
      try {
        if (isMounted) {
          setStartupStatusText('로그인 정보를 확인하고 있습니다.');
        }
        const entries = await withTimeout(
          AppStorage.multiGet([STORAGE_KEYS.accounts, STORAGE_KEYS.session]),
          STORAGE_LOAD_TIMEOUT_MS,
          [
            [STORAGE_KEYS.accounts, null],
            [STORAGE_KEYS.session, null],
          ] as [string, string | null][]
        );
        const stored = Object.fromEntries(entries);
        const parsedAccounts = sanitizeStoredAccounts(parseStoredJson<unknown[]>(stored[STORAGE_KEYS.accounts], []));
        const parsedSession = sanitizeStoredSession(parseStoredJson<unknown>(stored[STORAGE_KEYS.session], null));

        if (!isMounted) {
          return;
        }

        remoteTokenRef.current = parsedSession?.remoteToken ?? null;
        setAccounts(parsedAccounts);
        setAuthMode('login');

        if (startupRecoveryTriggeredRef.current) {
          setStartupStatusText('로그인 화면을 준비하고 있습니다.');
          return;
        }

        setStartupStatusText(parsedSession?.userId ? '로그인한 계정을 불러오고 있습니다.' : '로그인 화면을 준비하고 있습니다.');
        await AppStorage.setItem(STORAGE_KEYS.accounts, JSON.stringify(parsedAccounts));

        if (!parsedSession?.userId) {
          return;
        }

        const sessionAccount = parsedAccounts.find((account) => account.id === parsedSession.userId);

        if (parsedSession.remoteToken) {
          const remoteResult = await fetchRemoteSession(parsedSession.remoteToken);

          if (!isMounted) {
            return;
          }

          if (remoteResult.success && remoteResult.account && remoteResult.token) {
            await activateRemoteAccount({
              account: remoteResult.account,
              keepSignedIn: true,
              snapshot: remoteResult.snapshot,
              token: remoteResult.token,
              baseAccounts: parsedAccounts,
            });
            return;
          }

          if (sessionAccount) {
            setCurrentUser(toAuthUser(sessionAccount));
            return;
          }

          remoteTokenRef.current = null;
          await AppStorage.removeItem(STORAGE_KEYS.session);
          return;
        }

        if (sessionAccount?.password) {
          const legacySnapshot = await readStoredAccountSnapshot(sessionAccount.id);
          let remoteResult = await loginRemoteAccount({
            nickname: sessionAccount.nickname,
            password: sessionAccount.password,
          });

          if (!isMounted) {
            return;
          }

          if (!remoteResult.success && remoteResult.code === 'account_not_found') {
            remoteResult = await signupRemoteAccount({
              nickname: sessionAccount.nickname,
              password: sessionAccount.password,
              createdAt: sessionAccount.createdAt,
              snapshot: buildRemoteSnapshot(legacySnapshot),
            });
          }

          if (!isMounted) {
            return;
          }

          if (remoteResult.success && remoteResult.account && remoteResult.token) {
            await activateRemoteAccount({
              account: remoteResult.account,
              keepSignedIn: true,
              snapshot: remoteResult.snapshot,
              token: remoteResult.token,
              baseAccounts: parsedAccounts,
            });
            return;
          }
        }

        if (sessionAccount) {
          setCurrentUser(toAuthUser(sessionAccount));
        } else {
          remoteTokenRef.current = null;
          await AppStorage.removeItem(STORAGE_KEYS.session);
        }
      } catch {
        remoteTokenRef.current = null;

        try {
          await AppStorage.removeItem(STORAGE_KEYS.session);
          await AppStorage.setItem(STORAGE_KEYS.accounts, JSON.stringify([]));
        } catch {
          // Ignore storage cleanup failures and continue to the login screen.
        }

        if (isMounted) {
          setAccounts([]);
          setCurrentUser(null);
          setAuthMode('login');
          setStartupStatusText('로그인 정보를 불러오지 못해 로그인 화면으로 이동합니다.');
        }
      } finally {
        if (isMounted) {
          setIsAuthReady(true);
        }
      }
    }

    void loadAuthState();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    if (!currentUserId) {
      resetAccountState();
      setIsAccountDataReady(false);
      setStartupStatusText('로그인 화면을 준비하고 있습니다.');
      return () => {
        isMounted = false;
      };
    }

    setIsAccountDataReady(false);
    resetAccountState();

    async function loadAccountData() {
      const scopedKeys = getAccountStorageKeys(currentUserId);

      try {
        if (isMounted) {
          setStartupStatusText('계정 데이터를 불러오고 있습니다.');
        }
        const [snapshot, storedPreviewValue] = await Promise.all([
          readStoredAccountSnapshot(currentUserId),
          AppStorage.getItem(scopedKeys.ballRecognitionPreviews),
        ]);

        if (!isMounted) {
          return;
        }

        const storedPreviews = sanitizeBallRecognitionPreviews(
          parseStoredJson<unknown>(storedPreviewValue, [])
        );
        const { nextAttendance } = applyAccountSnapshot(snapshot);
        setBallRecognitionPreviews(storedPreviews);

        await AppStorage.setItem(scopedKeys.attendance, JSON.stringify(nextAttendance));
      } catch {
        if (!isMounted) {
          return;
        }

        if (remoteTokenRef.current) {
          setStartupStatusText('계정 데이터를 복구하고 있습니다.');
          const remoteResult = await fetchRemoteSession(remoteTokenRef.current);

          if (remoteResult.success && remoteResult.snapshot) {
            const recoveredSnapshot = await writeStoredAccountSnapshot(currentUserId, remoteResult.snapshot);
            const { nextAttendance } = applyAccountSnapshot(recoveredSnapshot);

            await AppStorage.setItem(scopedKeys.attendance, JSON.stringify(nextAttendance));
            setStartupStatusText('');
            return;
          }
        }

        setStartupStatusText('계정 데이터를 불러오지 못해 기본 화면으로 이동합니다.');
        Alert.alert('불러오기 실패', '계정 데이터를 불러오는 중 문제가 발생했습니다.');
      } finally {
        if (isMounted) {
          setIsAccountDataReady(true);
        }
      }
    }

    void loadAccountData();

    return () => {
      isMounted = false;
    };
  }, [currentUserId, resetAccountState]);

  useEffect(() => {
    if (!__DEV__ || !currentUserId || !isAccountDataReady) {
      return;
    }

    if (seededDevTestUsersRef.current.has(currentUserId)) {
      return;
    }

    seededDevTestUsersRef.current.add(currentUserId);

    let isCancelled = false;

    async function seedDevTestLessonRecord() {
      const seedStorageKey = buildAccountStorageKey(DEV_TEST_SHOOT_RECORD_SEED_KEY, currentUserId);

      try {
        const seedStatus = await AppStorage.getItem(seedStorageKey);

        if (isCancelled) {
          return;
        }

        if (seedStatus === 'done') {
          return;
        }

        const existingSeedRecord = lessonRecordsRef.current.find((record) => record.id === DEV_TEST_SHOOT_RECORD_ID);

        if (existingSeedRecord) {
          const refreshedSeedRecord = buildDevTestShootBadLessonRecord(parseDateKeyToDate(existingSeedRecord.dateKey));
          const nextLessonRecords = lessonRecordsRef.current.map((record) =>
            record.id === DEV_TEST_SHOOT_RECORD_ID ? refreshedSeedRecord : record
          );

          lessonRecordsRef.current = nextLessonRecords;
          setLessonRecords(nextLessonRecords);
          persistLessonRecords(nextLessonRecords);
          await AppStorage.setItem(seedStorageKey, 'done');
          return;
        }

        const seedDate = new Date();
        const seededRecord = buildDevTestShootBadLessonRecord(seedDate);
        const nextLessonRecords = [...lessonRecordsRef.current, seededRecord];
        const nextShotAttemptRecords = {
          ...shotAttemptRecordsRef.current,
          [seededRecord.dateKey]: Math.max(0, shotAttemptRecordsRef.current[seededRecord.dateKey] || 0) + 1,
        };

        lessonRecordsRef.current = nextLessonRecords;
        shotAttemptRecordsRef.current = nextShotAttemptRecords;
        setLessonRecords(nextLessonRecords);
        setShotAttemptRecords(nextShotAttemptRecords);
        setSelectedDateKey(seededRecord.dateKey);
        persistLessonRecords(nextLessonRecords);
        persistScopedAccountValue('shotAttempts', nextShotAttemptRecords);
        await AppStorage.setItem(seedStorageKey, 'done');
      } catch {
        seededDevTestUsersRef.current.delete(currentUserId);
      }
    }

    void seedDevTestLessonRecord();

    return () => {
      isCancelled = true;
    };
  }, [currentUserId, isAccountDataReady, persistLessonRecords, persistScopedAccountValue]);

  useEffect(() => {
    if (isReady) {
      startupRecoveryTriggeredRef.current = false;
      setStartupStatusText('');
      return;
    }

    const timeout = setTimeout(() => {
      if (startupRecoveryTriggeredRef.current) {
        return;
      }

      startupRecoveryTriggeredRef.current = true;
      setStartupStatusText('시작이 오래 걸려 저장된 로그인 상태를 초기화하고 있습니다.');
      void recoverStartupToLogin();
    }, STARTUP_RECOVERY_TIMEOUT_MS);

    return () => {
      clearTimeout(timeout);
    };
  }, [isReady, recoverStartupToLogin]);

  useEffect(() => {
    if (!currentUserId || !isAccountDataReady) {
      return;
    }

    void AppStorage.setItem(getAccountStorageKeys(currentUserId).attendance, JSON.stringify(attendance));
  }, [attendance, currentUserId, isAccountDataReady]);

  useEffect(() => {
    if (!currentUserId || !isAccountDataReady) {
      return;
    }

    void AppStorage.setItem(getAccountStorageKeys(currentUserId).homework, JSON.stringify(homeworkState));
  }, [currentUserId, homeworkState, isAccountDataReady]);

  useEffect(() => {
    if (!currentUserId || !isAccountDataReady) {
      return;
    }

    persistLessonRecords(lessonRecords);
  }, [currentUserId, isAccountDataReady, lessonRecords, persistLessonRecords]);

  useEffect(() => {
    if (!currentUserId || !isAccountDataReady) {
      return;
    }

    void AppStorage.setItem(getAccountStorageKeys(currentUserId).dribbleCounts, JSON.stringify(dailyDribbleRecords));
  }, [currentUserId, dailyDribbleRecords, isAccountDataReady]);

  useEffect(() => {
    if (!currentUserId || !isAccountDataReady) {
      return;
    }

    void AppStorage.setItem(getAccountStorageKeys(currentUserId).shotAttempts, JSON.stringify(shotAttemptRecords));
  }, [currentUserId, isAccountDataReady, shotAttemptRecords]);

  useEffect(() => {
    if (!currentUserId || !isAccountDataReady) {
      return;
    }

    void AppStorage.setItem(getAccountStorageKeys(currentUserId).shotSuccess, JSON.stringify(shotSuccessRecords));
  }, [currentUserId, isAccountDataReady, shotSuccessRecords]);

  useEffect(() => {
    if (!currentUserId || !isAccountDataReady) {
      return;
    }

    void AppStorage.setItem(getAccountStorageKeys(currentUserId).ballColors, JSON.stringify(selectedBallColors));
  }, [currentUserId, isAccountDataReady, selectedBallColors]);

  useEffect(() => {
    if (!currentUserId || !isAccountDataReady) {
      return;
    }

    void AppStorage.setItem(getAccountStorageKeys(currentUserId).ballBrand, JSON.stringify(selectedBallBrand));
  }, [currentUserId, isAccountDataReady, selectedBallBrand]);

  useEffect(() => {
    if (!currentUserId || !isAccountDataReady) {
      return;
    }

    void AppStorage.setItem(
      getAccountStorageKeys(currentUserId).ballRecognitionProfile,
      JSON.stringify(ballRecognitionProfile)
    );
  }, [ballRecognitionProfile, currentUserId, isAccountDataReady]);

  useEffect(() => {
    if (!currentUserId || !isAccountDataReady) {
      return;
    }

    void AppStorage.setItem(
      getAccountStorageKeys(currentUserId).ballRecognitionPreviews,
      JSON.stringify(ballRecognitionPreviews)
    );
  }, [ballRecognitionPreviews, currentUserId, isAccountDataReady]);

  useEffect(() => {
    if (!currentUserId || !isAccountDataReady) {
      return;
    }

    void AppStorage.setItem(getAccountStorageKeys(currentUserId).position, JSON.stringify(selectedPosition));
  }, [currentUserId, isAccountDataReady, selectedPosition]);

  useEffect(() => {
    if (!currentUserId || !isAccountDataReady || !remoteTokenRef.current) {
      return;
    }

    if (remoteSnapshotText === lastRemoteSnapshotRef.current) {
      return;
    }

    const activeToken = remoteTokenRef.current;
    const timeout = setTimeout(() => {
      void (async () => {
        const result = await updateRemoteAccountSnapshot(activeToken, remoteSnapshot);

        if (result.success) {
          lastRemoteSnapshotRef.current = remoteSnapshotText;
        }
      })();
    }, 600);

    return () => {
      clearTimeout(timeout);
    };
  }, [currentUserId, isAccountDataReady, remoteSnapshot, remoteSnapshotText]);

  useEffect(() => {
    return () => {
      if (feedbackIntervalRef.current) {
        clearInterval(feedbackIntervalRef.current);
      }

      if (recordingFallbackTimeoutRef.current) {
        clearTimeout(recordingFallbackTimeoutRef.current);
      }

      if (shootAutoEndTimeoutRef.current) {
        clearTimeout(shootAutoEndTimeoutRef.current);
      }

      void stopStartCue();
      void unloadStartCue();
      void unloadCountdownCue();
      void closeWebStartCue();
    };
  }, []);

  useEffect(() => {
    if (!showFireworks) {
      return undefined;
    }

    const timer = setTimeout(() => {
      setShowFireworks(false);
      setFireworks([]);
    }, 1000);

    return () => clearTimeout(timer);
  }, [showFireworks]);

  const updateHomeworkStateForDate = useCallback(
    (dateKey: string, updater: (current: DailyHomeworkState) => DailyHomeworkState) => {
      setHomeworkState((current) => {
        const currentDailyState = getDailyHomeworkState(current, dateKey);
        const nextDailyState = updater(currentDailyState);
        const nextState = {
          ...current,
          [dateKey]: nextDailyState,
        };

        homeworkStateRef.current = nextState;
        return nextState;
      });
    },
    []
  );

  useEffect(() => {
    if (!currentUserId || !isAccountDataReady) {
      return;
    }

    if (!isDailyBaseHomeworkCompleted(todayDribbleCount, todayShootAttemptCount) || todayHomeworkState.stage2Unlock) {
      return;
    }

    setHomeworkState((current) => {
      const currentDailyState = getDailyHomeworkState(current, todayKey);

      if (currentDailyState.stage2Unlock) {
        return current;
      }

      const nextState = {
        ...current,
        [todayKey]: {
          ...currentDailyState,
          stage2Unlock: buildStage2UnlockSnapshot(
            selectedPosition,
            todayDribbleCount,
            todayShootAttemptCount,
            todayShotSuccessCount,
            todayLessonCount
          ),
        },
      };

      homeworkStateRef.current = nextState;
      return nextState;
    });
  }, [
    currentUserId,
    isAccountDataReady,
    todayDribbleCount,
    todayHomeworkState.stage2Unlock,
    todayKey,
    todayLessonCount,
    selectedPosition,
    todayShootAttemptCount,
    todayShotSuccessCount,
  ]);

  useEffect(() => {
    const countdownStartedAt = stanceCountdownStartedAtRef.current;

    if (!isLessonActive || !countdownStartedAt) {
      setCountdownValue(null);
      return undefined;
    }

    const updateCountdown = () => {
      const remaining = DRIBBLE_STANCE_HOLD_MS - (Date.now() - countdownStartedAt);
      if (remaining <= 0) {
        setCountdownValue(null);
        return;
      }

      setCountdownValue(Math.max(1, Math.ceil(remaining / 1000)));
    };

    updateCountdown();
    const timer = setInterval(updateCountdown, 100);

    return () => clearInterval(timer);
  }, [debugText, isLessonActive]);

  useEffect(() => {
    if (!isLessonActive || isCameraReady || cameraError) {
      return undefined;
    }

    const timer = setTimeout(() => {
      setDebugText('移대찓???쒖옉 ?묐떟??湲곕떎由щ뒗 以묒엯?덈떎.');
      setCameraError('移대찓???쒖옉??吏?곕릺怨??덉뒿?덈떎. ?좎떆 ?꾩뿉???붾㈃??鍮꾩뼱 ?덉쑝硫?吏꾪뻾 ?곹깭 臾멸뎄瑜??뚮젮 二쇱꽭??');
    }, 8000);

    return () => clearTimeout(timer);
  }, [cameraError, isCameraReady, isLessonActive]);

  useEffect(() => {
    if (!isLessonActive) {
      return undefined;
    }

    const timer = setInterval(() => {
      if (dribbleLessonPhaseRef.current !== 'countdown') {
        return;
      }

      const countdownStartedAt = stanceCountdownStartedAtRef.current;
      if (!countdownStartedAt) {
        return;
      }

      if (Date.now() - countdownStartedAt < DRIBBLE_STANCE_HOLD_MS) {
        return;
      }

      if (lessonModeRef.current === 'shoot') {
        startShootLessonFromCountdown();
        return;
      }

      startDribbleLessonFromCountdown(latestDribbleAnalysisRef.current?.bodyFacing === 'front');
    }, 80);

    return () => clearInterval(timer);
  }, [isLessonActive, startDribbleLessonFromCountdown, startShootLessonFromCountdown]);

  const appendFeedbackTimeline = useCallback((text: string) => {
    if (!isLessonActive || !text) {
      return;
    }

    const trimmed = text.trim();
    const previous = feedbackTimelineRef.current[feedbackTimelineRef.current.length - 1];
    if (previous?.text === trimmed) {
      return;
    }

    const startedAt = lessonStartedAtRef.current;
    if (startedAt === null) {
      return;
    }

    const atMs = Math.max(0, Date.now() - startedAt);
    feedbackTimelineRef.current.push({
      atMs,
      text: trimmed,
    });
  }, [isLessonActive]);

  const setFeedbackAndRemember = useCallback((nextFeedback: string) => {
    latestFeedbackRef.current = nextFeedback;
    setFeedbackText(nextFeedback);
    appendFeedbackTimeline(nextFeedback);
  }, [appendFeedbackTimeline]);

  const flushPendingFeedback = useCallback(() => {
    const pendingFeedback = pendingFeedbackRef.current?.trim();

    if (!pendingFeedback || pendingFeedback === latestFeedbackRef.current.trim()) {
      pendingFeedbackRef.current = null;
      return;
    }

    setFeedbackAndRemember(pendingFeedback);
    pendingFeedbackRef.current = null;
  }, [setFeedbackAndRemember]);

  const setImmediateLessonFeedback = useCallback((nextFeedback: string) => {
    pendingFeedbackRef.current = null;
    setFeedbackAndRemember(nextFeedback);
  }, [setFeedbackAndRemember]);

  const clearRecordingWait = useCallback(() => {
    pendingStopSaveRef.current = false;
    if (recordingFallbackTimeoutRef.current) {
      clearTimeout(recordingFallbackTimeoutRef.current);
      recordingFallbackTimeoutRef.current = null;
    }
  }, []);

  const clearShootAutoEnd = useCallback(() => {
    if (shootAutoEndTimeoutRef.current) {
      clearTimeout(shootAutoEndTimeoutRef.current);
      shootAutoEndTimeoutRef.current = null;
    }
  }, []);

  const resetShootAnalysisTracking = useCallback(() => {
    pendingShootReviewRef.current = false;
    pendingShootRecordingStopRef.current = false;
    latestShootAnalysisRef.current = null;
    shootAnalysisHistoryRef.current = [];
    shootAnalysisFramesRef.current = [];
    shootCooldownUntilRef.current = null;
    shootRecordingStartedRef.current = false;
    shootFeedbackLockedRef.current = false;
  }, []);

  const hasCompletedShootAttempt = useCallback(
    () =>
      shootAnalysisHistoryRef.current.some((item) => item.releaseDetected)
      || latestShootAnalysisRef.current?.releaseDetected === true,
    []
  );

  const resetFrontDribbleTrackingSummary = useCallback(() => {
    latestDribbleAnalysisRef.current = null;
    dribbleAnalysisFramesRef.current = [];
    frontDribbleCriterionCountsRef.current = createFrontDribbleCriterionCounter();
    frontDribbleWeakPointRef.current = null;
    frontDribbleSummaryShownRef.current = false;
  }, []);

  const updateFrontDribbleWeakPoint = useCallback((analysis: DribbleAnalysis) => {
    if (analysis.bodyFacing !== 'front') {
      return;
    }

    latestDribbleAnalysisRef.current = analysis;

    if (analysis.stanceState !== 'ready' && analysis.stanceState !== 'unknown') {
      frontDribbleCriterionCountsRef.current[1] += 1;
    }

    if (analysis.frontBallLaneState === 'between_legs') {
      frontDribbleCriterionCountsRef.current[2] += 1;
    }

    if (analysis.handBalanceState === 'unbalanced') {
      frontDribbleCriterionCountsRef.current[3] += 1;
    }

    if (analysis.footSpacingState === 'narrow' || analysis.footSpacingState === 'wide') {
      frontDribbleCriterionCountsRef.current[4] += 1;
    }
  }, []);

  const finalizeFrontDribbleWeakPoint = useCallback(() => {
    const analysis = latestDribbleAnalysisRef.current;

    if (!analysis || analysis.bodyFacing !== 'front') {
      frontDribbleWeakPointRef.current = null;
      return null;
    }

    const counts = frontDribbleCriterionCountsRef.current;
    const ranked = (Object.entries(counts) as Array<[string, number]>)
      .map(([criterionNumber, count]) => ({
        criterionNumber: Number(criterionNumber) as FrontDribbleCriterionNumber,
        count,
      }))
      .sort((left, right) => {
        if (right.count !== left.count) {
          return right.count - left.count;
        }

        return left.criterionNumber - right.criterionNumber;
      });

    const strongestIssue = ranked[0];

    if (!strongestIssue || strongestIssue.count <= 0) {
      frontDribbleWeakPointRef.current = null;
      return null;
    }

    const summary = {
      criterionNumber: strongestIssue.criterionNumber,
      feedbackText: buildFrontCriterionFeedback(strongestIssue.criterionNumber, analysis),
      count: strongestIssue.count,
    } satisfies FrontDribbleWeakPoint;

    frontDribbleWeakPointRef.current = summary;
    return summary;
  }, []);

  const ensureWebStartCueContext = useCallback(async () => {
    if (Platform.OS !== 'web') {
      return null;
    }

    const browserWindow = globalThis as typeof globalThis & {
      AudioContext?: new () => any;
      webkitAudioContext?: new () => any;
    };
    const AudioContextCtor = browserWindow.AudioContext ?? browserWindow.webkitAudioContext;

    if (!AudioContextCtor) {
      return null;
    }

    if (!webStartCueContextRef.current) {
      webStartCueContextRef.current = new AudioContextCtor();
    }

    const context = webStartCueContextRef.current;

    if (context.state === 'suspended' && typeof context.resume === 'function') {
      try {
        await context.resume();
      } catch {
        // Ignore resume failures and fall back to the native sound path below.
      }
    }

    return context;
  }, []);

  const closeWebStartCue = useCallback(async () => {
    const context = webStartCueContextRef.current;
    webStartCueContextRef.current = null;

    if (!context || typeof context.close !== 'function') {
      return;
    }

    try {
      await context.close();
    } catch {
      // Ignore close failures during teardown.
    }
  }, []);

  const ensureAudioPlaybackMode = useCallback(async () => {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
    });
  }, []);

  const ensureStartCueSound = useCallback(async () => {
    if (Platform.OS === 'web') {
      return null;
    }

    if (startCueSoundRef.current) {
      return startCueSoundRef.current;
    }

    await ensureAudioPlaybackMode();

    const { sound } = await Audio.Sound.createAsync(require('../../assets/sounds/whistle-start.wav'));
    startCueSoundRef.current = sound;
    return sound;
  }, [ensureAudioPlaybackMode]);

  const ensureCountdownCueSound = useCallback(async () => {
    if (Platform.OS === 'web') {
      return null;
    }

    if (countdownCueSoundRef.current) {
      return countdownCueSoundRef.current;
    }

    await ensureAudioPlaybackMode();

    let countdownCueUri = countdownCueUriRef.current;
    if (!countdownCueUri) {
      const cacheDirectory = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
      if (!cacheDirectory) {
        return null;
      }

      countdownCueUri = `${cacheDirectory}lesson-countdown-cue.wav`;
      countdownCueUriRef.current = countdownCueUri;

      const fileInfo = await FileSystem.getInfoAsync(countdownCueUri);
      if (!fileInfo.exists) {
        await FileSystem.writeAsStringAsync(countdownCueUri, COUNTDOWN_CUE_BASE64, {
          encoding: FileSystem.EncodingType.Base64,
        });
      }
    }

    const { sound } = await Audio.Sound.createAsync({ uri: countdownCueUri });
    countdownCueSoundRef.current = sound;
    return sound;
  }, [ensureAudioPlaybackMode]);

  const stopStartCue = useCallback(async () => {
    const sound = startCueSoundRef.current;
    if (!sound) {
      return;
    }

    try {
      await sound.stopAsync();
      await sound.setPositionAsync(0);
    } catch {
      // Ignore transient sound stop failures.
    }
  }, []);

  const unloadStartCue = useCallback(async () => {
    const sound = startCueSoundRef.current;
    startCueSoundRef.current = null;

    if (!sound) {
      return;
    }

    try {
      await sound.unloadAsync();
    } catch {
      // Ignore unload failures during cleanup.
    }
  }, []);

  const unloadCountdownCue = useCallback(async () => {
    const sound = countdownCueSoundRef.current;
    countdownCueSoundRef.current = null;

    if (!sound) {
      return;
    }

    try {
      await sound.unloadAsync();
    } catch {
      // Ignore unload failures during cleanup.
    }
  }, []);

  const playCountdownCue = useCallback(() => {
    void (async () => {
      try {
        if (Platform.OS === 'web') {
          const context = await ensureWebStartCueContext();

          if (context) {
            const now = context.currentTime;
            const oscillator = context.createOscillator();
            const gain = context.createGain();
            const cueDuration = 0.14;

            oscillator.type = 'triangle';
            oscillator.frequency.setValueAtTime(980, now);
            oscillator.frequency.exponentialRampToValueAtTime(760, now + cueDuration);

            gain.gain.setValueAtTime(0.0001, now);
            gain.gain.exponentialRampToValueAtTime(0.11, now + 0.015);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + cueDuration);

            oscillator.connect(gain);
            gain.connect(context.destination);

            oscillator.start(now);
            oscillator.stop(now + cueDuration);
            return;
          }
        }

        const sound = await ensureCountdownCueSound();
        if (sound) {
          await sound.replayAsync();
        }
      } catch {
        // Keep the lesson flow running even if the cue sound fails.
      }
    })();
  }, [ensureCountdownCueSound, ensureWebStartCueContext]);

  const playStartCue = useCallback(() => {
    void (async () => {
      try {
        if (Platform.OS === 'web') {
          const context = await ensureWebStartCueContext();

          if (context) {
            const now = context.currentTime;
            const oscillator = context.createOscillator();
            const gain = context.createGain();
            const vibrato = context.createOscillator();
            const vibratoGain = context.createGain();
            const whistleDuration = 0.7;

            oscillator.type = 'square';
            oscillator.frequency.setValueAtTime(2200, now);
            oscillator.frequency.exponentialRampToValueAtTime(1760, now + whistleDuration);

            vibrato.type = 'sine';
            vibrato.frequency.setValueAtTime(18, now);
            vibratoGain.gain.setValueAtTime(80, now);

            gain.gain.setValueAtTime(0.0001, now);
            gain.gain.exponentialRampToValueAtTime(0.18, now + 0.02);
            gain.gain.setValueAtTime(0.18, now + whistleDuration - 0.16);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + whistleDuration);

            vibrato.connect(vibratoGain);
            vibratoGain.connect(oscillator.frequency);
            oscillator.connect(gain);
            gain.connect(context.destination);

            oscillator.start(now);
            vibrato.start(now);
            oscillator.stop(now + whistleDuration);
            vibrato.stop(now + whistleDuration);
            return;
          }
        }

        const sound = await ensureStartCueSound();
        if (sound) {
          await sound.replayAsync();
        }
      } catch {
        // Keep the lesson flow running even if the cue sound fails.
      }
    })();
  }, [ensureStartCueSound, ensureWebStartCueContext]);

  const playLessonCompletionCueOnce = useCallback(() => {
    if (lessonCompletionCuePlayedRef.current) {
      return;
    }

    lessonCompletionCuePlayedRef.current = true;
    playStartCue();
  }, [playStartCue]);

  useEffect(() => {
    if (!isLessonActive || countdownValue === null) {
      lastCountdownCueValueRef.current = null;
      return;
    }

    if (lastCountdownCueValueRef.current === countdownValue) {
      return;
    }

    lastCountdownCueValueRef.current = countdownValue;
    playCountdownCue();
  }, [countdownValue, isLessonActive, playCountdownCue]);

  const celebrateHomeworkCompletion = useCallback(() => {
    setFireworks(createFireworks());
    setShowFireworks(true);
  }, []);

  const recordSkillVideoOpen = useCallback(
    (skillKey: SkillKey) => {
      const dateKey = formatDateKey(new Date());

      updateHomeworkStateForDate(dateKey, (current) => ({
        ...current,
        skillVideoEvents: [
          ...current.skillVideoEvents,
          {
            skillKey,
            openedAt: new Date().toISOString(),
          },
        ],
      }));
    },
    [updateHomeworkStateForDate]
  );

  const recordFrontDribbleHomeworkData = useCallback(
    (analysis: DribbleAnalysis | null) => {
      if (!analysis || analysis.bodyFacing !== 'front') {
        return;
      }

      const leftHandDribbleCount = Math.max(0, analysis.leftHandDribbleCount);
      const rightHandDribbleCount = Math.max(0, analysis.rightHandDribbleCount);

      if (leftHandDribbleCount === 0 && rightHandDribbleCount === 0) {
        return;
      }

      const dateKey = formatDateKey(new Date());

      updateHomeworkStateForDate(dateKey, (current) => {
        const nextHandDribbleTotals = {
          left: current.handDribbleTotals.left + leftHandDribbleCount,
          right: current.handDribbleTotals.right + rightHandDribbleCount,
        };

        return {
          ...current,
          handDribbleTotals: nextHandDribbleTotals,
          correctionTask: buildCorrectionHomeworkState(leftHandDribbleCount, rightHandDribbleCount, nextHandDribbleTotals),
        };
      });
    },
    [updateHomeworkStateForDate]
  );

  const applyHomeworkTestState = useCallback(
    (nextState: HomeworkTestState) => {
      const dateKey = formatDateKey(new Date());
      const safeDribbleCount = Math.max(0, Math.trunc(nextState.dribbleCount));
      const safeShootAttemptCount = Math.max(0, Math.trunc(nextState.shootAttemptCount));
      const safeShotSuccessCount = Math.max(0, Math.min(Math.trunc(nextState.shotSuccessCount), safeShootAttemptCount));
      const safeSkillVideoOpenCount = Math.max(0, Math.trunc(nextState.skillVideoOpenCount));
      const safeLeftHandTotal = Math.max(0, Math.trunc(nextState.leftHandTotal));
      const safeRightHandTotal = Math.max(0, Math.trunc(nextState.rightHandTotal));
      const safeCorrectionProgress = Math.max(0, Math.trunc(nextState.correctionProgress));
      const stage2Position = todayHomeworkState.stage2Unlock?.position ?? selectedPosition;
      const skillKeyForTest: SkillKey =
        stage2Position === 'defense' ? 'defense' : stage2Position === 'offense' ? 'shoot' : 'shoot';
      const skillVideoEvents = Array.from({ length: safeSkillVideoOpenCount }, (_, index) => ({
        skillKey: skillKeyForTest,
        openedAt: new Date(Date.now() + index).toISOString(),
      }));
      const correctionTask =
        nextState.correctionDirection === 'none'
          ? null
          : {
              direction: nextState.correctionDirection,
              baselineCount: Math.max(
                0,
                (nextState.correctionDirection === 'left' ? safeLeftHandTotal : safeRightHandTotal) - safeCorrectionProgress
              ),
              createdAt: new Date().toISOString(),
            };
      const stage2Unlock = nextState.isStage2Unlocked
        ? todayHomeworkState.stage2Unlock ??
          buildStage2UnlockSnapshot(
            stage2Position,
            safeDribbleCount,
            safeShootAttemptCount,
            safeShotSuccessCount,
            todayLessonCount
          )
        : null;

      dailyDribbleRecordsRef.current = {
        ...dailyDribbleRecordsRef.current,
        [dateKey]: safeDribbleCount,
      };
      setDailyDribbleRecords(dailyDribbleRecordsRef.current);
      persistScopedAccountValue('dribbleCounts', dailyDribbleRecordsRef.current);

      shotAttemptRecordsRef.current = {
        ...shotAttemptRecordsRef.current,
        [dateKey]: safeShootAttemptCount,
      };
      setShotAttemptRecords(shotAttemptRecordsRef.current);
      persistScopedAccountValue('shotAttempts', shotAttemptRecordsRef.current);

      shotSuccessRecordsRef.current = {
        ...shotSuccessRecordsRef.current,
        [dateKey]: safeShotSuccessCount,
      };
      setShotSuccessRecords(shotSuccessRecordsRef.current);
      persistScopedAccountValue('shotSuccess', shotSuccessRecordsRef.current);

      updateHomeworkStateForDate(dateKey, (current) => ({
        ...current,
        stage2Unlock,
        skillVideoEvents,
        handDribbleTotals: {
          left: safeLeftHandTotal,
          right: safeRightHandTotal,
        },
        correctionTask,
      }));
    },
    [persistScopedAccountValue, selectedPosition, todayHomeworkState.stage2Unlock, todayLessonCount, updateHomeworkStateForDate]
  );

  const recordDailyDribbleProgress = useCallback(
    (count: number) => {
      const amount = Math.max(0, count);
      const dateKey = formatDateKey(new Date());
      const previous = dailyDribbleRecordsRef.current[dateKey] || 0;
      const next = previous + amount;

      dailyDribbleRecordsRef.current = {
        ...dailyDribbleRecordsRef.current,
        [dateKey]: next,
      };
      setDailyDribbleRecords(dailyDribbleRecordsRef.current);

      return previous < DAILY_DRIBBLE_TARGET && next >= DAILY_DRIBBLE_TARGET;
    },
    []
  );

  const updateShotAttemptCount = useCallback((dateKey: string, delta: number) => {
    if (delta === 0) {
      return shotAttemptRecordsRef.current[dateKey] || 0;
    }

    const currentCount = shotAttemptRecordsRef.current[dateKey] || 0;
    const nextCount = Math.max(0, currentCount + delta);

    if (nextCount === currentCount) {
      return currentCount;
    }

    const nextRecords = { ...shotAttemptRecordsRef.current };

    if (nextCount === 0) {
      delete nextRecords[dateKey];
    } else {
      nextRecords[dateKey] = nextCount;
    }

    shotAttemptRecordsRef.current = nextRecords;
    setShotAttemptRecords(nextRecords);
    persistScopedAccountValue('shotAttempts', nextRecords);
    return nextCount;
  }, [persistScopedAccountValue]);

  const updateShotSuccessCount = useCallback((dateKey: string, delta: number) => {
    if (delta === 0) {
      return shotSuccessRecordsRef.current[dateKey] || 0;
    }

    const currentCount = shotSuccessRecordsRef.current[dateKey] || 0;
    const nextCount = Math.max(0, currentCount + delta);

    if (nextCount === currentCount) {
      return currentCount;
    }

    const nextRecords = { ...shotSuccessRecordsRef.current };

    if (nextCount === 0) {
      delete nextRecords[dateKey];
    } else {
      nextRecords[dateKey] = nextCount;
    }

    shotSuccessRecordsRef.current = nextRecords;
    setShotSuccessRecords(nextRecords);
    persistScopedAccountValue('shotSuccess', nextRecords);
    return nextCount;
  }, [persistScopedAccountValue]);

  const recordDailyShootAttempt = useCallback(() => {
    const dateKey = formatDateKey(new Date());
    const previous = shotAttemptRecordsRef.current[dateKey] || 0;
    const next = updateShotAttemptCount(dateKey, 1);

    return previous < DAILY_SHOOT_TARGET && next >= DAILY_SHOOT_TARGET;
  }, [updateShotAttemptCount]);

  const recordSuccessfulShot = useCallback(
    (options?: { preserveFeedback?: boolean; debugMessage?: string; celebrate?: boolean }) => {
      const todayKey = formatDateKey(new Date());
      const nextCount = updateShotSuccessCount(todayKey, 1);
      shootSuccessRecordedForCurrentAttemptRef.current = true;

      if (!options?.preserveFeedback) {
        const nextText = `?ㅻ뒛 ???깃났 ${nextCount}媛쒕? 湲곕줉?덉뒿?덈떎.`;
        setFeedbackAndRemember(nextText);
      }

      if (options?.debugMessage) {
        setDebugText(options.debugMessage);
      }

      setIsShootSuccessButtonVisible(false);

      if (options?.celebrate !== false) {
        setFireworks(createFireworks());
        setShowFireworks(true);
      }

      return nextCount;
    },
    [setFeedbackAndRemember, updateShotSuccessCount]
  );

  const saveLessonRecord = useCallback(async (videoUri: string, reviewClip?: LessonReviewClip | null) => {
    const normalizedVideoUri = videoUri.trim();

    if (!normalizedVideoUri) {
      return false;
    }

    const dateKey = formatDateKey(new Date());
    const mode = lessonModeRef.current;
    const latestDribbleAnalysis = latestDribbleAnalysisRef.current;
    const shotOutcome = mode === 'shoot' ? (shootSuccessRecordedForCurrentAttemptRef.current ? 'success' : 'failure') : undefined;
    const evaluation =
      mode === 'shoot'
        ? buildShootRecordEvaluation(latestShootAnalysisRef.current, [...shootAnalysisFramesRef.current], shotOutcome)
        : buildDribbleRecordEvaluation([...dribbleAnalysisFramesRef.current]);
    const representativeFeedback = selectRepresentativeFeedbackFromTimeline(
      [...feedbackTimelineRef.current],
      latestFeedbackRef.current
    );
    const recordId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const persistedVideoUri = await persistLessonRecordVideoToFile(currentUserId ?? 'local', recordId, normalizedVideoUri);
    const persistedThumbnailUri = await persistLessonRecordThumbnailToFile(
      currentUserId ?? 'local',
      recordId,
      persistedVideoUri
    );
    const nextRecord = normalizeLessonRecord({
      id: recordId,
      dateKey,
      mode,
      shotOutcome,
      feedback: representativeFeedback,
      feedbackTimeline: [...feedbackTimelineRef.current],
      videoUri: persistedVideoUri,
      thumbnailUri: persistedThumbnailUri,
      createdAt: new Date().toLocaleString(),
      reviewFeedback: reviewClip?.feedback,
      reviewStartAtMs: reviewClip?.startAtMs,
      reviewDurationMs: reviewClip?.durationMs,
      dribbleView: mode === 'dribble' ? selectedDribbleViewRef.current : undefined,
      leftHandDribbleCount:
        mode === 'dribble' && selectedDribbleViewRef.current === 'front'
          ? Math.max(0, latestDribbleAnalysis?.leftHandDribbleCount ?? 0)
          : undefined,
      rightHandDribbleCount:
        mode === 'dribble' && selectedDribbleViewRef.current === 'front'
          ? Math.max(0, latestDribbleAnalysis?.rightHandDribbleCount ?? 0)
          : undefined,
      representativeFeedbackCategory: undefined,
      evaluation,
    });

    const nextLessonRecords = [...lessonRecordsRef.current, nextRecord];
    lessonRecordsRef.current = nextLessonRecords;
    setLessonRecords(nextLessonRecords);
    persistLessonRecords(nextLessonRecords);

    setSelectedDateKey(dateKey);
    return true;
  }, [currentUserId, persistLessonRecords]);

  const finalizeLessonSession = useCallback(
    async (shouldSaveRecord: boolean, videoUri: string, keepCameraPreview = false) => {
      if (feedbackIntervalRef.current) {
        clearInterval(feedbackIntervalRef.current);
        feedbackIntervalRef.current = null;
      }

      clearRecordingWait();
      clearShootAutoEnd();
      pendingReviewStopRef.current = false;
      void stopStartCue();
      void unloadStartCue();

      const shouldPersistShootRecord =
        lessonModeRef.current !== 'shoot' || hasCompletedShootAttempt();

      const didSaveLessonRecord =
        shouldSaveRecord && shouldPersistShootRecord
          ? await saveLessonRecord(videoUri)
          : false;

      if (didSaveLessonRecord && lessonModeRef.current === 'shoot') {
          const completedShootHomework = recordDailyShootAttempt();
          if (completedShootHomework) {
            celebrateHomeworkCompletion();
            setImmediateLessonFeedback(getHomeworkCompletionMessage('shoot'));
          }
      }

      lessonStartedAtRef.current = null;
      dribbleLessonPhaseRef.current = 'stance_setup';
      shootLessonStartedRef.current = false;
      resetShootAnalysisTracking();
      dribbleTargetCountRef.current = null;
      dribbleAutoEndingRef.current = false;
      stanceCountdownStartedAtRef.current = null;
      feedbackTimelineRef.current = [];
      pendingFeedbackRef.current = null;
      resetFrontDribbleTrackingSummary();
      completedDribbleCountRef.current = 0;
      setCurrentDribbleCount(0);
      setCountdownValue(null);
      setDribbleResetToken(0);
      setShootResetToken(0);
      setRecordingStartToken(0);
      setRecordingStopToken(0);
      setCameraStopMode(null);
      setIsCameraPreviewHidden(false);
      setIsLessonActive(false);
      setCameraError('');
      setIsShootSuccessButtonVisible(false);
      if (keepCameraPreview) {
        setIsCameraActive(true);
        setIsCameraReady(true);
        setDebugText('레슨을 종료했습니다. 카메라는 계속 켜져 있습니다.');
        return;
      }

      setIsCameraActive(false);
      setIsCameraReady(false);
      setDebugText('移대찓?쇱? MediaPipe瑜?以鍮꾪븯怨??덉뒿?덈떎.');
    },
    [
      celebrateHomeworkCompletion,
      clearRecordingWait,
      clearShootAutoEnd,
      hasCompletedShootAttempt,
      recordDailyShootAttempt,
      resetFrontDribbleTrackingSummary,
      resetShootAnalysisTracking,
      saveLessonRecord,
      setImmediateLessonFeedback,
    ]
  );

  function changeAuthMode(nextMode: AuthMode) {
    setAuthMode(nextMode);
  }

  async function createTransferCode(): Promise<TransferCodeResult> {
    if (!currentUserId) {
      return {
        success: false,
        message: '?꾩넚 肄붾뱶瑜?留뚮뱾?ㅻ㈃ 癒쇱? 濡쒓렇?명빐 二쇱꽭??',
      };
    }

    const currentAccount = accounts.find((account) => account.id === currentUserId);

    if (!currentAccount) {
      return {
        success: false,
        message: '?꾩옱 怨꾩젙 ?뺣낫瑜?李얠? 紐삵뻽?듬땲?? ?ㅼ떆 濡쒓렇?명븳 ???쒕룄??二쇱꽭??',
      };
    }

    const payload: AccountTransferPayload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      account: currentAccount,
      data: {
        attendance,
        lessonRecords: lessonRecords.map((record) => ({
          ...record,
          videoUri: '',
        })),
        dribbleCounts: dailyDribbleRecords,
        shotAttempts: shotAttemptRecords,
        shotSuccess: shotSuccessRecords,
        ballColors: selectedBallColors,
        ballBrand: selectedBallBrand,
        ballRecognitionProfile,
        position: selectedPosition,
        homework: homeworkState,
      },
    };

    return {
      success: true,
      message: '?꾩넚 肄붾뱶瑜?留뚮뱾?덉뒿?덈떎. ?대???濡쒓렇???붾㈃?먯꽌 遺숈뿬?ｌ쑝硫?怨꾩젙??媛?몄삱 ???덉뒿?덈떎.',
      code: JSON.stringify(payload),
    };
  }

  async function importAccountTransfer(code: string): Promise<AuthActionResult> {
    const trimmedCode = code.trim();

    if (!trimmedCode) {
      return {
        success: false,
        message: '遺숈뿬?ｌ? ?꾩넚 肄붾뱶媛 鍮꾩뼱 ?덉뒿?덈떎.',
      };
    }

    let parsedPayload: unknown;

    try {
      parsedPayload = JSON.parse(trimmedCode);
    } catch {
      return {
        success: false,
        message: '?꾩넚 肄붾뱶瑜??쎌? 紐삵뻽?듬땲?? 而댄벂?곗뿉??留뚮뱺 肄붾뱶瑜?洹몃?濡?遺숈뿬?ｌ뼱 二쇱꽭??',
      };
    }

    const payload = sanitizeTransferPayload(parsedPayload);

    if (!payload) {
      return {
        success: false,
        message: '吏?먰븯吏 ?딅뒗 ?꾩넚 肄붾뱶?낅땲?? 理쒖떊 ?깆뿉???ㅼ떆 肄붾뱶瑜?留뚮뱾??二쇱꽭??',
      };
    }

    const normalizedNickname = normalizeNickname(payload.account.nickname);
    const existingAccount =
      accounts.find((account) => account.id === payload.account.id) ??
      accounts.find((account) => normalizeNickname(account.nickname) === normalizedNickname);
    const targetAccountId = existingAccount?.id ?? payload.account.id;
    const nextAccount: UserAccount = {
      ...payload.account,
      nickname: payload.account.nickname.trim().replace(/\s+/g, ' '),
      id: targetAccountId,
    };
    const scopedKeys = getAccountStorageKeys(targetAccountId);
    const existingPreviewValue = await AppStorage.getItem(scopedKeys.ballRecognitionPreviews);
    const existingPreviews = sanitizeBallRecognitionPreviews(parseStoredJson<unknown>(existingPreviewValue, []));
    const nextAccounts = [
      ...accounts.filter((account) => {
        if (account.id === targetAccountId) {
          return false;
        }

        return normalizeNickname(account.nickname) !== normalizedNickname;
      }),
      nextAccount,
    ];

    await deleteBallRecognitionPreviewFiles(existingPreviews);

    await AppStorage.multiSet([
      [STORAGE_KEYS.accounts, JSON.stringify(nextAccounts)],
      [scopedKeys.ballRecognitionPreviews, JSON.stringify([])],
    ]);
    await writeStoredAccountSnapshot(targetAccountId, {
      attendance: payload.data.attendance,
      lessonRecords: payload.data.lessonRecords,
      dribbleCounts: payload.data.dribbleCounts,
      shotAttempts: payload.data.shotAttempts,
      shotSuccess: payload.data.shotSuccess,
      ballColors: payload.data.ballColors,
      ballBrand: payload.data.ballBrand,
      ballRecognitionProfile: payload.data.ballRecognitionProfile,
      position: payload.data.position,
      homework: payload.data.homework,
    }, { preserveExistingLessonRecords: false });
    await persistSession(targetAccountId, true);

    setAccounts(nextAccounts);
    setCurrentUser(toAuthUser(nextAccount));
    setAuthMode('login');

    return {
      success: true,
      message: '怨꾩젙??媛?몄???諛붾줈 濡쒓렇?명뻽?듬땲??',
    };
  }

  async function login({ nickname, password, keepSignedIn }: AuthFormValues): Promise<AuthActionResult> {
    const trimmedNickname = sanitizeAccountNickname(nickname);
    const trimmedPassword = password.trim();

    if (!trimmedNickname || !trimmedPassword) {
      return {
        success: false,
        message: '닉네임과 비밀번호를 모두 입력해 주세요.',
      };
    }

    const remoteResult = await loginRemoteAccount({
      nickname: trimmedNickname,
      password: trimmedPassword,
    });

    if (remoteResult.success && remoteResult.account && remoteResult.token) {
      await activateRemoteAccount({
        account: remoteResult.account,
        keepSignedIn,
        snapshot: remoteResult.snapshot,
        token: remoteResult.token,
      });

      return {
        success: true,
        message: '로그인되었습니다.',
      };
    }

    const normalizedNickname = normalizeNickname(trimmedNickname);
    const legacyAccount = accounts.find(
      (account) => normalizeNickname(account.nickname) === normalizedNickname && account.password === trimmedPassword
    );

    if (remoteResult.code === 'account_not_found' && legacyAccount?.password) {
      const legacySnapshot = await readStoredAccountSnapshot(legacyAccount.id);
      const migrateResult = await signupRemoteAccount({
        nickname: trimmedNickname,
        password: trimmedPassword,
        createdAt: legacyAccount.createdAt,
        snapshot: buildRemoteSnapshot(legacySnapshot),
      });

      if (migrateResult.success && migrateResult.account && migrateResult.token) {
        await activateRemoteAccount({
          account: migrateResult.account,
          keepSignedIn,
          snapshot: migrateResult.snapshot,
          token: migrateResult.token,
        });

        return {
          success: true,
          message: '기존 계정을 공용 로그인 계정으로 연결했습니다.',
        };
      }

      return {
        success: false,
        message: migrateResult.message,
      };
    }

    return {
      success: false,
      message: remoteResult.message,
    };
  }
  async function signup({ nickname, password, keepSignedIn }: AuthFormValues): Promise<AuthActionResult> {
    const trimmedNickname = sanitizeAccountNickname(nickname);
    const trimmedPassword = password.trim();

    if (!trimmedNickname || !trimmedPassword) {
      return {
        success: false,
        message: '닉네임과 비밀번호를 모두 입력해 주세요.',
      };
    }

    const remoteResult = await signupRemoteAccount({
      nickname: trimmedNickname,
      password: trimmedPassword,
      createdAt: new Date().toISOString(),
      snapshot: createEmptyRemoteSnapshot(),
    });

    if (!remoteResult.success || !remoteResult.account || !remoteResult.token) {
      return {
        success: false,
        message: remoteResult.message,
      };
    }

    await activateRemoteAccount({
      account: remoteResult.account,
      keepSignedIn,
      snapshot: remoteResult.snapshot,
      token: remoteResult.token,
    });

    return {
      success: true,
      message: '회원가입이 완료되었습니다.',
    };
  }
  async function updateProfile({ nickname }: ProfileUpdateValues): Promise<AuthActionResult> {
    if (!currentUserId) {
      return {
        success: false,
        message: '로그인한 계정을 먼저 확인해 주세요.',
      };
    }

    const trimmedNickname = sanitizeAccountNickname(nickname);

    if (!trimmedNickname) {
      return {
        success: false,
        message: '닉네임을 입력해 주세요.',
      };
    }

    const currentAccount = accounts.find((account) => account.id === currentUserId);

    if (!currentAccount) {
      return {
        success: false,
        message: '현재 계정 정보를 찾지 못했습니다.',
      };
    }

    if (currentAccount.nickname === trimmedNickname) {
      return {
        success: true,
        message: '변경된 정보가 없어 현재 닉네임을 유지했습니다.',
      };
    }

    if (remoteTokenRef.current) {
      const remoteResult = await updateRemoteAccountProfile(remoteTokenRef.current, {
        nickname: trimmedNickname,
      });

      if (!remoteResult.success || !remoteResult.account) {
        return {
          success: false,
          message: remoteResult.message,
        };
      }

      const nextAccount = buildCachedAccount(remoteResult.account);
      const nextAccounts = mergeCachedAccounts(accounts, nextAccount);

      await AppStorage.setItem(STORAGE_KEYS.accounts, JSON.stringify(nextAccounts));
      setAccounts(nextAccounts);
      setCurrentUser(toAuthUser(nextAccount));

      return {
        success: true,
        message: remoteResult.message || '닉네임을 변경했습니다.',
      };
    }

    const normalizedNickname = normalizeNickname(trimmedNickname);
    const duplicatedAccount = accounts.find(
      (account) => account.id !== currentUserId && normalizeNickname(account.nickname) === normalizedNickname
    );

    if (duplicatedAccount) {
      return {
        success: false,
        message: '이미 사용 중인 닉네임입니다. 다른 닉네임을 입력해 주세요.',
      };
    }

    const nextAccount: UserAccount = {
      ...currentAccount,
      nickname: trimmedNickname,
    };
    const nextAccounts = accounts.map((account) => (account.id === currentUserId ? nextAccount : account));

    await AppStorage.setItem(STORAGE_KEYS.accounts, JSON.stringify(nextAccounts));
    setAccounts(nextAccounts);
    setCurrentUser(toAuthUser(nextAccount));

    return {
      success: true,
      message: '닉네임을 수정했습니다.',
    };
  }
  async function changePassword({
    currentPassword,
    nextPassword,
    nextPasswordConfirm,
  }: PasswordChangeValues): Promise<AuthActionResult> {
    if (!currentUserId) {
      return {
        success: false,
        message: '로그인한 계정을 먼저 확인해 주세요.',
      };
    }

    const trimmedCurrentPassword = currentPassword.trim();
    const trimmedNextPassword = nextPassword.trim();
    const trimmedNextPasswordConfirm = nextPasswordConfirm.trim();

    if (!trimmedCurrentPassword || !trimmedNextPassword || !trimmedNextPasswordConfirm) {
      return {
        success: false,
        message: '현재 비밀번호와 새 비밀번호를 모두 입력해 주세요.',
      };
    }

    if (trimmedNextPassword !== trimmedNextPasswordConfirm) {
      return {
        success: false,
        message: '새 비밀번호가 서로 일치하지 않습니다.',
      };
    }

    if (trimmedNextPassword === trimmedCurrentPassword) {
      return {
        success: false,
        message: '새 비밀번호가 현재 비밀번호와 같습니다. 다른 비밀번호를 입력해 주세요.',
      };
    }

    const currentAccount = accounts.find((account) => account.id === currentUserId);

    if (!currentAccount) {
      return {
        success: false,
        message: '현재 계정 정보를 찾지 못했습니다.',
      };
    }

    if (remoteTokenRef.current) {
      const remoteResult = await updateRemoteAccountPassword(remoteTokenRef.current, {
        currentPassword: trimmedCurrentPassword,
        nextPassword: trimmedNextPassword,
      });

      return {
        success: remoteResult.success,
        message: remoteResult.message,
      };
    }

    if (currentAccount.password !== trimmedCurrentPassword) {
      return {
        success: false,
        message: '현재 비밀번호가 일치하지 않습니다.',
      };
    }

    const nextAccount: UserAccount = {
      ...currentAccount,
      password: trimmedNextPassword,
    };
    const nextAccounts = accounts.map((account) => (account.id === currentUserId ? nextAccount : account));

    await AppStorage.setItem(STORAGE_KEYS.accounts, JSON.stringify(nextAccounts));
    setAccounts(nextAccounts);

    return {
      success: true,
      message: '비밀번호를 수정했습니다.',
    };
  }
  async function logout() {
    if (screen === 'lesson' && (isLessonActive || isCameraActive)) {
      await endLesson(true);
    }

    remoteTokenRef.current = null;
    lastRemoteSnapshotRef.current = '';
    await AppStorage.removeItem(STORAGE_KEYS.session);
    setCurrentUser(null);
    setAuthMode('login');
  }
  async function navigateTo(nextScreen: AppScreen) {
    if (screen === 'lesson' && nextScreen !== 'lesson' && (isLessonActive || isCameraActive)) {
      await endLesson(true);
    }

    setScreen(nextScreen);
    if (nextScreen === 'lesson') {
      void startLessonCameraPreview();
    }
    if (nextScreen === 'diary' && !selectedDateKey) {
      const today = new Date();
      setSelectedDateKey(formatDateKey(today));
      setCurrentDate(today);
    }
  }

  function selectSkill(skillKey: SkillKey) {
    setSelectedSkillKey(skillKey);
  }

  function toggleBallColor(color: BallColorOption) {
    setSelectedBallColors((current) => {
      const exists = current.includes(color);
      if (exists) {
        const next = current.filter((item) => item !== color);
        return next.length > 0 ? next : DEFAULT_BALL_COLORS;
      }

      return [...current, color];
    });
  }

  function selectBallBrand(brand: BallBrandOption) {
    setSelectedBallBrand(brand);
    setSelectedBallColors(BALL_BRAND_PRESETS[brand]);
  }

  function selectPosition(position: PositionOption) {
    setSelectedPosition(position);
  }

  async function buildExistingPendingBallRecognitionPreviews() {
    return (
      await Promise.all(
        ballRecognitionPreviews.map((preview) => hydrateStoredBallRecognitionPreview(preview))
      )
    ).filter((preview): preview is PendingBallRecognitionPreview => Boolean(preview));
  }

  async function queuePendingBallRecognitionCalibration(
    newPendingPreviews: PendingBallRecognitionPreview[],
    mode: 'replace' | 'append'
  ) {
    const existingPendingPreviews = mode === 'append' ? await buildExistingPendingBallRecognitionPreviews() : [];
    const nextPendingPreviews = sortBallRecognitionPreviewsByCreatedAt([
      ...existingPendingPreviews,
      ...newPendingPreviews,
    ]).slice(-BALL_RECOGNITION_PREVIEW_LIMIT);

    if (nextPendingPreviews.length === 0) {
      setIsBallRecognitionTraining(false);
      return;
    }

    setBallRecognitionCalibrationJob({
      id: `job-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      previousPreviews: ballRecognitionPreviews,
      previews: nextPendingPreviews.map((preview) => stripPendingBallRecognitionPreview(preview)),
      pendingPreviews: nextPendingPreviews,
    });
  }

  async function queueBallRecognitionCalibration(
    assets: ImagePicker.ImagePickerAsset[],
    source: BallTrainingImageSource,
    mode: 'replace' | 'append'
  ) {
    if (!currentUserId || assets.length === 0 || isBallRecognitionTraining || ballRecognitionCalibrationJob) {
      return;
    }

    const limitedAssets = assets.slice(0, BALL_RECOGNITION_PREVIEW_LIMIT);
    let newPendingPreviews: PendingBallRecognitionPreview[] = [];

    setIsBallRecognitionTraining(true);

    try {
      newPendingPreviews = await Promise.all(
        limitedAssets.map((asset) => buildPendingBallRecognitionPreview(currentUserId, asset, source))
      );
      await queuePendingBallRecognitionCalibration(newPendingPreviews, mode);
    } catch {
      await deleteBallRecognitionPreviewFiles(
        newPendingPreviews.map((preview) =>
          stripPendingBallRecognitionPreview(preview)
        )
      );
      setIsBallRecognitionTraining(false);
      Alert.alert('공 학습 실패', '공 이미지를 준비하는 중 문제가 발생했습니다. 다시 시도해 주세요.');
    }
  }

  async function startBallRecognitionTrainingFromLibrary() {
    if (!currentUserId || isBallRecognitionTraining || ballRecognitionCalibrationJob) {
      return;
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert('권한 필요', '공 이미지를 고르려면 사진 보관함 권한이 필요합니다.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: BALL_RECOGNITION_PREVIEW_LIMIT,
      quality: 0.5,
      base64: true,
    });

    if (result.canceled) {
      return;
    }

    await queueBallRecognitionCalibration(result.assets, 'library', 'replace');
  }

  async function startBallRecognitionTrainingFromCamera() {
    if (!currentUserId || isBallRecognitionTraining || ballRecognitionCalibrationJob) {
      return;
    }

    const permission = await ImagePicker.requestCameraPermissionsAsync();

    if (!permission.granted) {
      Alert.alert('권한 필요', '공 이미지를 촬영하려면 카메라 권한이 필요합니다.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.5,
      base64: true,
      cameraType: ImagePicker.CameraType.back,
    });

    if (result.canceled) {
      return;
    }

    await queueBallRecognitionCalibration(result.assets, 'camera', 'append');
  }

  async function startBallRecognitionTrainingFromUrls(rawUrls: string) {
    if (!currentUserId || isBallRecognitionTraining || ballRecognitionCalibrationJob) {
      return;
    }

    const parsedUrls = parseBallRecognitionImageUrls(rawUrls).slice(0, BALL_RECOGNITION_PREVIEW_LIMIT);

    if (parsedUrls.length === 0) {
      Alert.alert('URL 확인', '학습할 이미지 URL을 한 줄에 하나씩 입력해 주세요.');
      return;
    }

    const newPendingPreviews: PendingBallRecognitionPreview[] = [];
    setIsBallRecognitionTraining(true);

    try {
      const results = await Promise.allSettled(
        parsedUrls.map((url) => buildPendingBallRecognitionPreviewFromUrl(currentUserId, url))
      );
      const failedCount = results.filter((result) => result.status === 'rejected').length;

      for (const result of results) {
        if (result.status === 'fulfilled') {
          newPendingPreviews.push(result.value);
        }
      }

      if (newPendingPreviews.length === 0) {
        throw new Error('remote_ball_images_unavailable');
      }

      if (failedCount > 0) {
        Alert.alert(
          '일부 이미지 생략',
          `${parsedUrls.length}장 중 ${failedCount}장은 불러오지 못해서, 나머지 이미지로 학습을 이어갑니다.`
        );
      }

      await queuePendingBallRecognitionCalibration(newPendingPreviews, 'replace');
    } catch {
      await deleteBallRecognitionPreviewFiles(
        newPendingPreviews.map((preview) => stripPendingBallRecognitionPreview(preview))
      );
      setIsBallRecognitionTraining(false);
      Alert.alert(
        '공 학습 실패',
        '인터넷 이미지 URL을 불러오지 못했습니다. 직접 열리는 이미지 주소인지 확인한 뒤 다시 시도해 주세요.'
      );
    }
  }

  async function handleBallRecognitionCalibrationFailure(job: BallRecognitionCalibrationJob, message: string) {
    const previousPreviewIds = new Set(job.previousPreviews.map((preview) => preview.id));
    const transientPreviews = job.pendingPreviews
      .filter((preview) => !previousPreviewIds.has(preview.id))
      .map((preview) => stripPendingBallRecognitionPreview(preview));

    await deleteBallRecognitionPreviewFiles(transientPreviews);
    setBallRecognitionCalibrationJob(null);
    setIsBallRecognitionTraining(false);
    Alert.alert('공 학습 실패', message);
  }

  async function handleBallRecognitionCalibrationComplete(jobId: string, nextProfile: BallRecognitionProfile | null) {
    if (!ballRecognitionCalibrationJob || ballRecognitionCalibrationJob.id !== jobId) {
      return;
    }

    const activeJob = ballRecognitionCalibrationJob;
    const sanitizedProfile = sanitizeBallRecognitionProfile(nextProfile);

    if (!sanitizedProfile) {
      await handleBallRecognitionCalibrationFailure(activeJob, '공 이미지에서 색상 정보를 충분히 찾지 못했습니다.');
      return;
    }

    const nextPreviewIds = new Set(activeJob.previews.map((preview) => preview.id));
    const obsoletePreviews = activeJob.previousPreviews.filter((preview) => !nextPreviewIds.has(preview.id));

    await deleteBallRecognitionPreviewFiles(obsoletePreviews);

    setBallRecognitionCalibrationJob(null);
    setBallRecognitionProfile(sanitizedProfile);
    setBallRecognitionPreviews(activeJob.previews);
    setSelectedBallColors(
      sanitizedProfile.learnedColors.length > 0 ? sanitizedProfile.learnedColors : DEFAULT_BALL_COLORS
    );
    setIsBallRecognitionTraining(false);
  }

  async function handleBallRecognitionCalibrationError(jobId: string, message: string) {
    if (!ballRecognitionCalibrationJob || ballRecognitionCalibrationJob.id !== jobId) {
      return;
    }

    await handleBallRecognitionCalibrationFailure(ballRecognitionCalibrationJob, message);
  }

  async function resetBallRecognitionTraining() {
    if (!currentUserId || isBallRecognitionTraining) {
      return;
    }

    await deleteBallRecognitionPreviewFiles(ballRecognitionPreviews);
    setBallRecognitionCalibrationJob(null);
    setBallRecognitionProfile(null);
    setBallRecognitionPreviews([]);
    setSelectedBallColors(BALL_BRAND_PRESETS[selectedBallBrand] ?? DEFAULT_BALL_COLORS);
  }

  function changeLessonMode(mode: LessonMode) {
    setLessonMode(mode);
    setIsShootSuccessButtonVisible(false);
    dribbleLessonPhaseRef.current = 'stance_setup';
    shootLessonStartedRef.current = false;
    resetShootAnalysisTracking();
    dribbleTargetCountRef.current = null;
    dribbleAutoEndingRef.current = false;
    lessonCompletionCuePlayedRef.current = false;
    pendingReviewStopRef.current = false;
    clearShootAutoEnd();
    resetFrontDribbleTrackingSummary();
    completedDribbleCountRef.current = 0;
    setCurrentDribbleCount(0);
    stanceCountdownStartedAtRef.current = null;
    setCountdownValue(null);
    setDribbleResetToken(0);
    setShootResetToken(0);
    setRecordingStartToken(0);
    setRecordingStopToken(0);
    setCameraStopMode(null);
    setIsCameraPreviewHidden(false);
    setLessonReview(null);
    setImmediateLessonFeedback(
      mode === 'shoot'
        ? buildShootStanceFeedback({
            armAngle: null,
            legAngle: null,
            releaseVelocity: null,
            lowestLegAngle: null,
            headPeakY: null,
            releasePointY: null,
            releaseDurationMs: null,
            releaseDetected: false,
            ballNearShootingHand: false,
            shootingHandRaised: false,
            readyPoseDetected: false,
            armAngleState: 'unknown',
            releaseTiming: 'unknown',
            legAngleState: 'unknown',
            releasePointState: 'unknown',
            releaseDurationState: 'unknown',
            summary: '',
          })
        : buildDribbleStanceFeedbackForView({
            dribbleStarted: false,
            dribbleView: selectedDribbleViewRef.current,
            bodyFacing: 'unknown',
            eyeFocus: 'unknown',
            dribbleHeight: 'unknown',
            torsoPosture: 'unknown',
            torsoLeanAngle: null,
            stanceState: 'unknown',
            frontStanceAngle: null,
            bounceHighState: 'unknown',
            bounceLowState: 'unknown',
            dribbleCount: 0,
            leftHandDribbleCount: 0,
            rightHandDribbleCount: 0,
            handBalanceState: 'unknown',
            frontBallLaneState: 'unknown',
            footSpacingState: 'unknown',
            highestBounceY: null,
            lowestBounceY: null,
            dribbleRhythmState: 'unknown',
            dribbleRhythmGoodCount: 0,
            dribbleRhythmBadCount: 0,
            dribbleRhythmComparisonCount: 0,
            summary: '',
          }, selectedDribbleViewRef.current)
    );
    setDebugText(mode === 'shoot' ? '??遺꾩꽍 紐⑤뱶瑜?以鍮꾪븯??以묒엯?덈떎.' : '?쒕━釉?遺꾩꽍 紐⑤뱶瑜?以鍮꾪븯??以묒엯?덈떎.');
  }

  function startFeedbackLoop(mode: LessonMode) {
    if (feedbackIntervalRef.current) {
      clearInterval(feedbackIntervalRef.current);
      feedbackIntervalRef.current = null;
    }

    pendingFeedbackRef.current = null;
    dribbleLessonPhaseRef.current = 'stance_setup';
    shootLessonStartedRef.current = false;
    resetShootAnalysisTracking();
    dribbleAutoEndingRef.current = false;
    lessonCompletionCuePlayedRef.current = false;
    pendingReviewStopRef.current = false;
    clearShootAutoEnd();
    resetFrontDribbleTrackingSummary();
    setCurrentDribbleCount(mode === 'dribble' ? completedDribbleCountRef.current : 0);
    stanceCountdownStartedAtRef.current = null;
    setCountdownValue(null);
    setDribbleResetToken(0);
    setShootResetToken(0);
    setRecordingStopToken(0);
    setCameraStopMode(null);
    setIsCameraPreviewHidden(false);
    setLessonReview(null);
    setIsShootSuccessButtonVisible(false);
    if (mode === 'dribble') {
      setImmediateLessonFeedback(buildDribbleStanceFeedbackForView({
        dribbleStarted: false,
        dribbleView: selectedDribbleViewRef.current,
        bodyFacing: 'unknown',
        eyeFocus: 'unknown',
        dribbleHeight: 'unknown',
        torsoPosture: 'unknown',
        torsoLeanAngle: null,
        stanceState: 'unknown',
        frontStanceAngle: null,
        bounceHighState: 'unknown',
        bounceLowState: 'unknown',
        dribbleCount: 0,
        leftHandDribbleCount: 0,
        rightHandDribbleCount: 0,
        handBalanceState: 'unknown',
        frontBallLaneState: 'unknown',
        footSpacingState: 'unknown',
        highestBounceY: null,
        lowestBounceY: null,
        dribbleRhythmState: 'unknown',
        dribbleRhythmGoodCount: 0,
        dribbleRhythmBadCount: 0,
        dribbleRhythmComparisonCount: 0,
        summary: '',
      }, selectedDribbleViewRef.current));
    } else {
      setImmediateLessonFeedback(buildShootStanceFeedback({
        armAngle: null,
        legAngle: null,
        releaseVelocity: null,
        lowestLegAngle: null,
        headPeakY: null,
        releasePointY: null,
        releaseDurationMs: null,
        releaseDetected: false,
        ballNearShootingHand: false,
        shootingHandRaised: false,
        readyPoseDetected: false,
        armAngleState: 'unknown',
        releaseTiming: 'unknown',
        legAngleState: 'unknown',
        releasePointState: 'unknown',
        releaseDurationState: 'unknown',
        summary: '',
      }));
    }
    feedbackIntervalRef.current = setInterval(() => {
      flushPendingFeedback();
    }, FEEDBACK_UPDATE_INTERVAL_MS);
  }

  async function ensurePermissions() {
    const cameraGranted = cameraPermission?.granted === true || (await requestCameraPermission()).granted;

    if (!cameraGranted) {
      Alert.alert('沅뚰븳 ?꾩슂', '?덉뒯 珥ъ쁺怨??먯꽭 遺꾩꽍???꾪빐 移대찓??沅뚰븳???꾩슂?⑸땲??');
      return false;
    }

    return true;
  }

  async function startLessonCameraPreview() {
    if (
      isCameraActive
      || pendingStopSaveRef.current
      || pendingReviewStopRef.current
      || pendingShootReviewRef.current
      || pendingShootRecordingStopRef.current
    ) {
      return false;
    }

    const granted = await ensurePermissions();
    if (!granted) {
      return false;
    }

    clearRecordingWait();
    clearShootAutoEnd();
    setCameraSessionKey((current) => current + 1);
    setCameraError('');
    lessonStartedAtRef.current = null;
    dribbleLessonPhaseRef.current = 'stance_setup';
    shootLessonStartedRef.current = false;
    resetShootAnalysisTracking();
    dribbleTargetCountRef.current = null;
    dribbleAutoEndingRef.current = false;
    lessonCompletionCuePlayedRef.current = false;
    stanceCountdownStartedAtRef.current = null;
    feedbackTimelineRef.current = [];
    resetFrontDribbleTrackingSummary();
    completedDribbleCountRef.current = 0;
    setCurrentDribbleCount(0);
    setCountdownValue(null);
    setDribbleResetToken(0);
    setShootResetToken(0);
    setRecordingStartToken(0);
    setRecordingStopToken(0);
    setCameraStopMode(null);
    setLessonReview(null);
    setIsCameraPreviewHidden(false);
    setIsShootSuccessButtonVisible(false);
    setIsLessonActive(false);
    setIsCameraActive(true);
    setIsCameraReady(false);
    setDebugText('MediaPipe 분석 화면과 카메라를 준비하고 있습니다.');
    return true;
  }

  async function beginLesson(dribbleTargetCount?: number, dribbleView?: DribbleLessonView) {
    if (
      isLessonActive
      || pendingStopSaveRef.current
      || pendingReviewStopRef.current
      || pendingShootReviewRef.current
      || pendingShootRecordingStopRef.current
    ) {
      setDebugText('?댁쟾 ?덉뒯??醫낅즺?섎뒗 以묒엯?덈떎. 移대찓?쇨? ?꾩쟾??爰쇱쭊 ???ㅼ떆 ?쒖옉??二쇱꽭??');
      return;
    }

    const granted = await ensurePermissions();
    if (!granted) {
      return;
    }

    const shouldReuseCameraPreview =
      isCameraActive
      && !isCameraPreviewHidden
      && cameraStopMode === null
      && !cameraError;

    clearRecordingWait();
    clearShootAutoEnd();
    if (!shouldReuseCameraPreview) {
      setCameraSessionKey((current) => current + 1);
    }
    setCameraError('');
    lessonStartedAtRef.current = null;
    dribbleLessonPhaseRef.current = 'stance_setup';
    shootLessonStartedRef.current = false;
    resetShootAnalysisTracking();
    if (lessonModeRef.current === 'dribble' && dribbleView) {
      selectedDribbleViewRef.current = dribbleView;
      setSelectedDribbleView(dribbleView);
    }
    dribbleTargetCountRef.current =
      lessonModeRef.current === 'dribble' && typeof dribbleTargetCount === 'number' && dribbleTargetCount > 0
        ? dribbleTargetCount
        : null;
    dribbleAutoEndingRef.current = false;
    lessonCompletionCuePlayedRef.current = false;
    pendingReviewStopRef.current = false;
    stanceCountdownStartedAtRef.current = null;
    feedbackTimelineRef.current = [];
    resetFrontDribbleTrackingSummary();
    completedDribbleCountRef.current = 0;
    setCurrentDribbleCount(0);
    setCountdownValue(null);
    setDribbleResetToken(0);
    setShootResetToken(0);
    setRecordingStartToken(0);
    setRecordingStopToken(0);
    setCameraStopMode(null);
    setLessonReview(null);
    setIsCameraPreviewHidden(false);
    setIsShootSuccessButtonVisible(false);
    setIsLessonActive(true);
    setIsCameraActive(true);
    setIsCameraReady(false);
    setDebugText('MediaPipe 遺꾩꽍 ?붾㈃???쒖옉?섎뒗 以묒엯?덈떎.');
    void ensureWebStartCueContext();
    void ensureStartCueSound();
    startFeedbackLoop(lessonModeRef.current);
  }

  async function endLesson(forceClose = false) {
    if (!isLessonActive && !isCameraActive) {
      return;
    }

    if (
      !forceClose
      && (
        pendingStopSaveRef.current
        || pendingReviewStopRef.current
        || pendingShootReviewRef.current
        || pendingShootRecordingStopRef.current
      )
    ) {
      setDebugText('레슨 종료를 마무리하고 있습니다. 잠시만 기다려 주세요.');
      return;
    }

    if (feedbackIntervalRef.current) {
      clearInterval(feedbackIntervalRef.current);
      feedbackIntervalRef.current = null;
    }

    clearShootAutoEnd();
    void stopStartCue();
    void unloadStartCue();
    pendingFeedbackRef.current = null;
    pendingReviewStopRef.current = false;
    setCountdownValue(null);

    if (!isLessonActive) {
      const frontWeakPoint = frontDribbleWeakPointRef.current;

      if (!forceClose && lessonModeRef.current === 'dribble' && frontWeakPoint && !frontDribbleSummaryShownRef.current) {
        frontDribbleSummaryShownRef.current = true;
        setImmediateLessonFeedback(buildFrontWeakPointSummary(frontWeakPoint));
        setDebugText('?덉뒯 ?붿빟???뺤씤??二쇱꽭?? ?ㅼ떆 ?꾨Ⅴ硫?移대찓?쇰? 醫낅즺?⑸땲??');
        return;
      }

      clearRecordingWait();
      pendingStopSaveRef.current = false;
      lessonStartedAtRef.current = null;
      dribbleLessonPhaseRef.current = 'stance_setup';
      shootLessonStartedRef.current = false;
      resetShootAnalysisTracking();
      dribbleTargetCountRef.current = null;
      dribbleAutoEndingRef.current = false;
      stanceCountdownStartedAtRef.current = null;
      feedbackTimelineRef.current = [];
      resetFrontDribbleTrackingSummary();
      completedDribbleCountRef.current = 0;
      setCurrentDribbleCount(0);
      setDribbleResetToken(0);
      setShootResetToken(0);
      setRecordingStartToken(0);
      setRecordingStopToken(0);
      setCameraStopMode(null);
      setIsCameraPreviewHidden(false);
      setIsShootSuccessButtonVisible(false);
      setIsCameraActive(false);
      setIsCameraReady(false);
      setCameraError('');
      setDebugText('移대찓?쇱? MediaPipe瑜?以鍮꾪븯怨??덉뒿?덈떎.');
      return;
    }

    pendingStopSaveRef.current = true;
    setDebugText('?덉뒯 ?곸긽????ν븯??以묒엯?덈떎.');
    setIsLessonActive(false);
    setIsCameraReady(false);
    setCameraStopMode(forceClose ? 'disconnect' : 'review');
    setRecordingStopToken(Date.now());

    recordingFallbackTimeoutRef.current = setTimeout(() => {
      if (!pendingStopSaveRef.current) {
        return;
      }

      void finalizeLessonSession(true, '', !forceClose);
    }, 5000);
  }

  const scheduleShootAutoEnd = useCallback(() => {
    clearShootAutoEnd();
    shootAutoEndTimeoutRef.current = setTimeout(() => {
      if (!isLessonActive || lessonModeRef.current !== 'shoot') {
        return;
      }

      void endLesson();
    }, 5000);
  }, [clearShootAutoEnd, isLessonActive]);

  const resumeDribbleLessonCycle = useCallback(
    (debugMessage: string, reviewClip?: LessonReviewClip | null) => {
      clearRecordingWait();
      pendingReviewStopRef.current = false;
      lessonStartedAtRef.current = null;
      setIsLessonActive(true);
      setIsCameraActive(true);
      setIsCameraReady(true);
      setCameraError('');
      startFeedbackLoop('dribble');
      if (reviewClip) {
        setLessonReview(reviewClip);
      }
      setCurrentDribbleCount(completedDribbleCountRef.current);
      setDebugText(debugMessage);
    },
    [clearRecordingWait]
  );


  const finishDribbleRecordingForReview = useCallback(() => {
    if (feedbackIntervalRef.current) {
      clearInterval(feedbackIntervalRef.current);
      feedbackIntervalRef.current = null;
    }

    pendingStopSaveRef.current = false;
    pendingReviewStopRef.current = true;
    clearShootAutoEnd();
    pendingFeedbackRef.current = null;
    setCountdownValue(null);
    setIsLessonActive(false);
    setIsCameraReady(false);
    setIsCameraPreviewHidden(false);
    setCameraStopMode('review');
    setRecordingStopToken(Date.now());
    setDebugText('紐⑺몴 ?쒕━釉??잛닔???꾨떖?덉뒿?덈떎. 醫낅즺 ?몃（?쇨린瑜??몃━怨?移대찓???곌껐???꾨뒗 以묒엯?덈떎.');

    recordingFallbackTimeoutRef.current = setTimeout(() => {
      if (!pendingReviewStopRef.current) {
        return;
      }

      clearRecordingWait();
      pendingReviewStopRef.current = false;

      const frontWeakPoint = finalizeFrontDribbleWeakPoint();
      const finalFeedback = frontWeakPoint
        ? `${latestFeedbackRef.current}\n\n${buildFrontWeakPointSummary(frontWeakPoint)}`
        : latestFeedbackRef.current;
      recordFrontDribbleHomeworkData(selectedDribbleViewRef.current === 'front' ? latestDribbleAnalysisRef.current : null);
      const completedDribbleHomework = recordDailyDribbleProgress(dribbleTargetCountRef.current ?? 0);
      resumeDribbleLessonCycle('紐⑺몴 ?쒕━釉??잛닔瑜?紐⑤몢 梨꾩썙 ?덉뒯???앹꽦?섏뒿?덈떎. ?ㅼ떆 以鍮??먯꽭瑜?留욎떠 媛숈? ?잛닔濡??쒕━釉??덉뒯???붾컮濡??쒖옉???덉뒿?덈떎.');
      if (completedDribbleHomework) {
        celebrateHomeworkCompletion();
      }
    }, 4000);
  }, [
    celebrateHomeworkCompletion,
    clearRecordingWait,
    clearShootAutoEnd,
    finalizeFrontDribbleWeakPoint,
    recordDailyDribbleProgress,
    recordFrontDribbleHomeworkData,
    resumeDribbleLessonCycle,
    resetShootAnalysisTracking,
  ]);

  const completeDribbleReview = useCallback(
    async (videoUri: string) => {
      clearRecordingWait();
      pendingReviewStopRef.current = false;
      const frontWeakPoint = finalizeFrontDribbleWeakPoint();

      const reviewClip = buildReviewClipFromTimeline(
        [...feedbackTimelineRef.current],
        latestFeedbackRef.current,
        videoUri
      );
      const finalFeedback = frontWeakPoint
        ? `${reviewClip.feedback}\n\n${buildFrontWeakPointSummary(frontWeakPoint)}`
        : reviewClip.feedback;
      const finalReviewClip = {
        ...reviewClip,
        feedback: finalFeedback,
      };

      recordFrontDribbleHomeworkData(selectedDribbleViewRef.current === 'front' ? latestDribbleAnalysisRef.current : null);
      const completedDribbleHomework = recordDailyDribbleProgress(dribbleTargetCountRef.current ?? 0);
      await saveLessonRecord(videoUri, finalReviewClip);

      resumeDribbleLessonCycle(
        '紐⑺몴 ?쒕━釉??잛닔瑜?紐⑤몢 梨꾩썙 ?덉뒯???앹꽦?섏뒿?덈떎. ?ㅼ떆 以鍮??먯꽭瑜?留욎떠 媛숈? ?잛닔濡??쒕━釉??덉뒯???붾컮濡??쒖옉???덉뒿?덈떎.',
        finalReviewClip
      );
      if (completedDribbleHomework) {
        celebrateHomeworkCompletion();
      }
    },
    [
      celebrateHomeworkCompletion,
      clearRecordingWait,
      finalizeFrontDribbleWeakPoint,
      recordDailyDribbleProgress,
      recordFrontDribbleHomeworkData,
      resumeDribbleLessonCycle,
      resetShootAnalysisTracking,
      saveLessonRecord,
    ]
  );

  const completeShootReview = useCallback(
    async (videoUri: string) => {
      clearRecordingWait();
      pendingShootReviewRef.current = false;

      const recordedAnalyses = shootAnalysisHistoryRef.current;
      const finalAnalysis =
        [...recordedAnalyses].reverse().find((item) => item.releaseDetected) ??
        recordedAnalyses[recordedAnalyses.length - 1] ??
        latestShootAnalysisRef.current;

      const finalFeedback = buildShootReviewFeedback(finalAnalysis ?? null);
      latestFeedbackRef.current = finalFeedback;
      feedbackTimelineRef.current = [{ atMs: 0, text: finalFeedback }];
      setFeedbackText(finalFeedback);
      setLessonReview(null);

      const completedShootHomework = recordDailyShootAttempt();
      await saveLessonRecord(videoUri);

      lessonStartedAtRef.current = null;
      dribbleLessonPhaseRef.current = 'stance_setup';
      shootLessonStartedRef.current = false;
      resetShootAnalysisTracking();
      dribbleTargetCountRef.current = null;
      dribbleAutoEndingRef.current = false;
      lessonCompletionCuePlayedRef.current = false;
      stanceCountdownStartedAtRef.current = null;
      feedbackTimelineRef.current = [];
      pendingFeedbackRef.current = null;
      completedDribbleCountRef.current = 0;
      setCurrentDribbleCount(0);
      setCountdownValue(null);
      setDribbleResetToken(0);
      setShootResetToken(0);
      setRecordingStartToken(0);
      setRecordingStopToken(0);
      setCameraStopMode(null);
      setIsCameraPreviewHidden(false);
      setIsLessonActive(true);
      setIsCameraActive(true);
      setIsCameraReady(true);
      setCameraError('');
      setIsShootSuccessButtonVisible(!shootSuccessRecordedForCurrentAttemptRef.current);
      const completionText = completedShootHomework ? `\n\n${getHomeworkCompletionMessage('shoot')}` : '';
      shootFeedbackLockedRef.current = true;
      setImmediateLessonFeedback(`${finalFeedback}${completionText}`);
      setDebugText('??珥ъ쁺 遺꾩꽍???앸궗?듬땲?? 寃곌낵 ?쇰뱶諛깆쓣 ?좎??⑸땲??');
      if (completedShootHomework) {
        celebrateHomeworkCompletion();
      }
    },
    [
      celebrateHomeworkCompletion,
      clearRecordingWait,
      recordDailyShootAttempt,
      resetShootAnalysisTracking,
      saveLessonRecord,
      setImmediateLessonFeedback,
    ]
  );

  function startDribbleLessonFromCountdown(isFrontDribble: boolean) {
    if (dribbleLessonPhaseRef.current !== 'countdown') {
      return;
    }

    dribbleLessonPhaseRef.current = 'active';
    stanceCountdownStartedAtRef.current = null;
    setCountdownValue(null);
    setCurrentDribbleCount(completedDribbleCountRef.current);
    dribbleAnalysisFramesRef.current = [];
    setDribbleResetToken(Date.now());
    playStartCue();
    setRecordingStartToken(Date.now());
    setImmediateLessonFeedback(
      isFrontDribble
        ? '?쒖옉?⑸땲?? 吏湲덈????뱁솕瑜??쒖옉?섍퀬 ?쒕━釉??잛닔瑜??됰땲?? ?ㅼ젙???잛닔源뚯? ?쒕━釉뷀빐 二쇱꽭??'
        : '?쒖옉?⑸땲?? ?댁젣 ?쒕━釉붿쓣 吏꾪뻾??二쇱꽭?? 怨??믪씠? ?쒖꽑, ?먯꽭瑜?怨꾩냽 遺꾩꽍?⑸땲??'
    );
    setDebugText('移댁슫???꾨즺, ?쒕━釉??쒖옉');
  }

  function startShootLessonFromCountdown() {
    if (dribbleLessonPhaseRef.current !== 'countdown') {
      return;
    }

    shootLessonStartedRef.current = true;
    dribbleLessonPhaseRef.current = 'active';
    stanceCountdownStartedAtRef.current = null;
    setCountdownValue(null);
    pendingShootReviewRef.current = false;
    pendingShootRecordingStopRef.current = false;
    latestShootAnalysisRef.current = null;
    shootAnalysisHistoryRef.current = [];
    shootAnalysisFramesRef.current = [];
    shootSuccessRecordedForCurrentAttemptRef.current = false;
    setIsShootSuccessButtonVisible(false);
    setShootResetToken(Date.now());
    playStartCue();
    if (!shootRecordingStartedRef.current) {
      setRecordingStartToken(Date.now());
      shootRecordingStartedRef.current = true;
    }
    setImmediateLessonFeedback('?쒖옉?⑸땲?? ?댁젣 ?쏆쓣 諛쒖궗??二쇱꽭?? 珥ъ쁺???앸굹硫???湲곗? 寃곌낵瑜??뚮젮?쒕┰?덈떎.');
    setDebugText('移댁슫???꾨즺, ??珥ъ쁺 ?쒖옉');
  }

  const applyDribbleAnalysis = useCallback(
    (analysis: DribbleAnalysis) => {
      if (lessonModeRef.current !== 'dribble') {
        return;
      }

      const phase = dribbleLessonPhaseRef.current;
      const targetView = selectedDribbleViewRef.current;
      const stanceReady = isDribbleStanceReadyForView(analysis, targetView);
      const cumulativeAnalysis = buildCumulativeDribbleAnalysis(analysis);
      latestDribbleAnalysisRef.current = cumulativeAnalysis;

      if (phase === 'active') {
        const roundDribbleCount = Math.max(0, Math.trunc(analysis.dribbleCount));
        const effectiveAnalysis =
          targetView === 'front' && analysis.bodyFacing === 'front'
            ? {
                ...cumulativeAnalysis,
                dribbleStarted: true,
              }
            : cumulativeAnalysis;
        const startedAt = lessonStartedAtRef.current;

        if (startedAt !== null) {
          dribbleAnalysisFramesRef.current.push({
            atMs: Math.max(0, Date.now() - startedAt),
            analysis: effectiveAnalysis,
          });
        }

        stanceCountdownStartedAtRef.current = null;
        setCountdownValue(null);
        setCurrentDribbleCount(effectiveAnalysis.dribbleCount);
        updateFrontDribbleWeakPoint(effectiveAnalysis);
        const nextFeedback = buildDribbleFeedbackText(effectiveAnalysis);
        pendingFeedbackRef.current = nextFeedback;
        const targetCount = dribbleTargetCountRef.current;
        if (targetCount && roundDribbleCount >= targetCount && !dribbleAutoEndingRef.current) {
          dribbleAutoEndingRef.current = true;
          completedDribbleCountRef.current = effectiveAnalysis.dribbleCount;
          playLessonCompletionCueOnce();
          setImmediateLessonFeedback(nextFeedback);
          setDebugText(`紐⑺몴 ?쒕━釉?${targetCount}?뚯뿉 ?꾨떖???덉뒯??留덈Т由ы빀?덈떎.`);
          finishDribbleRecordingForReview();
          return;
        }
        setDebugText(`?쒕━釉?遺꾩꽍 以? ${effectiveAnalysis.summary}`);
        return;
      }

      if (phase === 'await_dribble' && analysis.dribbleStarted) {
        dribbleLessonPhaseRef.current = 'active';
        stanceCountdownStartedAtRef.current = null;
        setCountdownValue(null);
        setCurrentDribbleCount(cumulativeAnalysis.dribbleCount);
        pendingFeedbackRef.current = buildDribbleFeedbackText(cumulativeAnalysis);
        setDebugText(`?쒕━釉??쒖옉 媛먯?: ${cumulativeAnalysis.summary}`);
        return;
      }

      if (!stanceReady) {
        dribbleLessonPhaseRef.current = 'stance_setup';
        stanceCountdownStartedAtRef.current = null;
        setCountdownValue(null);
        pendingFeedbackRef.current = buildDribbleStanceFeedbackForView(analysis, targetView);
        setDebugText('?쒕━釉??꾩뿉 以鍮??먯꽭瑜?留욎텛??以묒엯?덈떎.');
        return;
      }

      if (phase === 'stance_setup') {
        dribbleLessonPhaseRef.current = 'countdown';
        stanceCountdownStartedAtRef.current = Date.now();
        setImmediateLessonFeedback('醫뗭븘?? 以鍮??먯꽭媛 湲곗???留욎븯?듬땲?? 3珥??숈븞 洹몃?濡??좎???二쇱꽭??');
        setDebugText('드리블 준비 자세 확인: 3초 유지 중');
        return;
      }

      if (phase === 'countdown') {
        const countdownStartedAt = stanceCountdownStartedAtRef.current ?? Date.now();
        const elapsed = Date.now() - countdownStartedAt;

        if (elapsed >= DRIBBLE_STANCE_HOLD_MS) {
          startDribbleLessonFromCountdown(analysis.bodyFacing === 'front');
          return;
        }

        const remainingSeconds = Math.max(1, Math.ceil((DRIBBLE_STANCE_HOLD_MS - elapsed) / 1000));
        pendingFeedbackRef.current =
          targetView === 'front'
            ? `?뺣㈃ ?쒕━釉?以鍮??먯꽭瑜??좎???二쇱꽭??
1. 諛?臾대쫷-?됰뜦??媛곷룄瑜?140~170?꾨줈 ?좎???二쇱꽭??
2. ${remainingSeconds}珥??숈븞 ?먯꽭瑜??좎??섎㈃ ?뱁솕? ?쒕━釉?移댁슫?멸? ?쒖옉?⑸땲??
3. 怨듦낵 ?섏껜媛 ?④퍡 ??蹂댁씠?꾨줉 ??二쇱꽭??`
            : `?녿え???쒕━釉?以鍮??먯꽭瑜??좎???二쇱꽭??
1. ?곸껜 湲곗슱湲곕? 40~80?꾨줈 ?좎???二쇱꽭??
2. ${remainingSeconds}珥??숈븞 ?먯꽭瑜??좎??섎㈃ ?쒕━釉붿쓣 ?쒖옉?⑸땲??
3. 怨듦낵 ?곸껜媛 ?④퍡 ??蹂댁씠?꾨줉 ??二쇱꽭??`;
        setDebugText(`以鍮??먯꽭 ?좎? 以? ${remainingSeconds}珥??⑥쓬`);
        return;
      }

      pendingFeedbackRef.current = '?댁젣 ?쒕━釉붿쓣 ?쒖옉??二쇱꽭?? 怨듭씠 諛?媛源뚯씠 ?대젮?붾떎媛 ?ㅼ떆 ?щ씪?ㅻ㈃ ?쒕━釉?遺꾩꽍???댁뼱媛묐땲??';
      setDebugText('드리블 시작 대기 중');
      return;
      setDebugText(`??遺꾩꽍 以? ${analysis.summary}`);
    },
    [finishDribbleRecordingForReview, startDribbleLessonFromCountdown, updateFrontDribbleWeakPoint]
  );

  const applyShootAnalysisWithStance = useCallback(
    (analysis: ShootAnalysis) => {
      if (lessonModeRef.current !== 'shoot') {
        return;
      }

      latestShootAnalysisRef.current = analysis;

      if (pendingShootReviewRef.current) {
        return;
      }

      const phase = dribbleLessonPhaseRef.current;
      const stanceReady = isShootStanceReady(analysis);

      if (shootFeedbackLockedRef.current) {
        if (!stanceReady) {
          setDebugText('?댁쟾 ???쇰뱶諛깆쓣 ?좎??섎뒗 以묒엯?덈떎. ?ㅼ떆 以鍮??먯꽭媛 留욎쑝硫??ㅼ쓬 ?쏆쓣 ?쒖옉?⑸땲??');
          return;
        }

        shootFeedbackLockedRef.current = false;
      }

      if (phase === 'cooldown') {
        const cooldownUntil = shootCooldownUntilRef.current;

        if (cooldownUntil && Date.now() < cooldownUntil) {
        const remainingSeconds = Math.max(1, Math.ceil((cooldownUntil - Date.now()) / 1000));
        setDebugText(`??諛쒖궗 ?뺤씤 ???뱁솕 留덈Т由?以? ${remainingSeconds}珥??⑥쓬`);
        return;
        }

        if (shootRecordingStartedRef.current) {
          pendingShootReviewRef.current = true;
          pendingShootRecordingStopRef.current = true;
          shootCooldownUntilRef.current = null;
          setDebugText('??珥ъ쁺??留덈Т由ы븯怨?遺꾩꽍 以묒엯?덈떎.');
          setCameraStopMode('review');
          setRecordingStopToken(Date.now());
          return;
        }

        dribbleLessonPhaseRef.current = 'stance_setup';
      }

      if (phase === 'active' || shootLessonStartedRef.current) {
        stanceCountdownStartedAtRef.current = null;
        setCountdownValue(null);
        const nextFeedback = buildShootFeedbackText(analysis);
        if (shootRecordingStartedRef.current) {
          shootAnalysisHistoryRef.current.push(analysis);
          const startedAt = lessonStartedAtRef.current;

          if (startedAt !== null) {
            shootAnalysisFramesRef.current.push({
              atMs: Math.max(0, Date.now() - startedAt),
              analysis,
            });
          }
        }

        pendingFeedbackRef.current = nextFeedback;

        if (analysis.releaseDetected) {
          shootLessonStartedRef.current = false;
          dribbleLessonPhaseRef.current = 'cooldown';
          shootCooldownUntilRef.current = Date.now() + SHOOT_SUCCESS_CIRCLE_WINDOW_MS;
          setIsShootSuccessButtonVisible(!shootSuccessRecordedForCurrentAttemptRef.current);
          setImmediateLessonFeedback(
            `${nextFeedback}\n\n슛 발사를 확인했습니다. ${SHOOT_SUCCESS_CIRCLE_WINDOW_SECONDS}초 동안 성공 동작을 확인한 뒤 기록과 분석을 이어갑니다.`
          );
          setDebugText(`슛 발사를 확인했습니다. ${SHOOT_SUCCESS_CIRCLE_WINDOW_SECONDS}초 동안 성공 제스처를 확인합니다.`);
          return;
        }

        setDebugText('??珥ъ쁺 以묒엯?덈떎. 怨듭씠 ?먯뿉??遺꾨━?섍퀬 ?덊똿 ?붿씠 鍮좊Ⅴ寃??댁???諛쒖궗 ?쒖젏??湲곕떎由ш퀬 ?덉뒿?덈떎.');
        return;
      }

      if (phase === 'countdown') {
        if (!stanceReady) {
          dribbleLessonPhaseRef.current = 'stance_setup';
          stanceCountdownStartedAtRef.current = null;
          setCountdownValue(null);
          pendingFeedbackRef.current =
            '??以鍮??먯꽭媛 ?먰듃?ъ죱?듬땲??\n1. ??媛곷룄瑜??ㅼ떆 80~120?꾨줈 留욎떠 二쇱꽭??\n2. 以鍮??먯꽭媛 ?ㅼ떆 ?≫엳硫?3珥?移댁슫?몃? 泥섏쓬遺???쒖옉?⑸땲??\n3. 移댁슫?멸? ?앸굹硫?洹몃븣 ???덉뒯???쒖옉?⑸땲??';
          setDebugText('??以鍮??먯꽭媛 臾대꼫??移댁슫?몃? ?ㅼ떆 ?쒖옉?⑸땲??');
          return;
        }

        const countdownStartedAt = stanceCountdownStartedAtRef.current ?? Date.now();
        const elapsed = Date.now() - countdownStartedAt;

        if (elapsed >= DRIBBLE_STANCE_HOLD_MS) {
          startShootLessonFromCountdown();
          return;
        }

        const remainingSeconds = Math.max(1, Math.ceil((DRIBBLE_STANCE_HOLD_MS - elapsed) / 1000));
        pendingFeedbackRef.current = `??以鍮??먯꽭瑜??좎???二쇱꽭??\n1. ??媛곷룄瑜?湲곗? 踰붿쐞 ?덉쑝濡?留욎떠 二쇱꽭??\n2. ${remainingSeconds}珥??숈븞 ?먯꽭瑜??좎??섎㈃ ???덉뒯???쒖옉?⑸땲??\n3. ?쏆씠 ?앸궃 ????湲곗? 寃곌낵瑜??뚮젮?쒕┰?덈떎.`;
        setDebugText(`??以鍮??먯꽭 ?좎? 以? ${remainingSeconds}珥??⑥쓬`);
        return;
      }

      if (!stanceReady) {
        dribbleLessonPhaseRef.current = 'stance_setup';
        stanceCountdownStartedAtRef.current = null;
        setCountdownValue(null);
        pendingFeedbackRef.current = buildShootStanceFeedback(analysis);
        setDebugText('??以鍮??먯꽭瑜?留욎텛??以묒엯?덈떎.');
        return;
      }

      if (phase === 'stance_setup') {
        dribbleLessonPhaseRef.current = 'countdown';
        stanceCountdownStartedAtRef.current = Date.now();
        setImmediateLessonFeedback('醫뗭븘?? ??以鍮??먯꽭媛 留욎븯?듬땲?? 3珥??숈븞 洹몃?濡??좎???二쇱꽭??');
        setDebugText('슛 준비 자세 확인: 3초 유지 중');
        return;
      }

      setDebugText('??以鍮??먯꽭瑜??뺤씤?섎뒗 以묒엯?덈떎.');
    },
    [setImmediateLessonFeedback, startShootLessonFromCountdown]
  );

  const handlePoseMessage = useCallback(
    (event: WebViewMessageEvent) => {
      try {
        const payload = JSON.parse(event.nativeEvent.data) as
          | { type: 'ready' }
          | { type: 'stream_started' }
          | { type: 'recording_started' }
          | { type: 'status'; message: string }
          | { type: 'points'; summary: string }
          | { type: 'dribble_analysis'; analysis: DribbleAnalysis }
          | { type: 'shoot_analysis'; analysis: ShootAnalysis }
          | { type: 'shoot_success_circle_detected' }
          | { type: 'recording_ready'; videoUri: string }
          | { type: 'recording_error'; message: string }
          | { type: 'error'; message: string };

        if (payload.type === 'ready') {
          setDebugText('MediaPipe 紐⑤뜽 以鍮??꾨즺');
          return;
        }

        if (payload.type === 'stream_started') {
          setIsCameraReady(true);
          setCameraError('');
          setDebugText('移대찓???곌껐 ?꾨즺, 遺꾩꽍???쒖옉?⑸땲??');
          return;
        }

        if (payload.type === 'recording_started') {
          lessonStartedAtRef.current = Date.now();
          feedbackTimelineRef.current = [];
          setCurrentDribbleCount(lessonModeRef.current === 'dribble' ? completedDribbleCountRef.current : 0);
          dribbleAnalysisFramesRef.current = [];
          latestShootAnalysisRef.current = null;
          shootAnalysisHistoryRef.current = [];
          shootAnalysisFramesRef.current = [];
          if (latestFeedbackRef.current.trim()) {
            feedbackTimelineRef.current.push({
              atMs: 0,
              text: latestFeedbackRef.current.trim(),
            });
          }
          setDebugText('?곸긽 ?뱁솕瑜??쒖옉?덉뒿?덈떎.');
          return;
        }

        if (payload.type === 'status') {
          setDebugText(payload.message);
          return;
        }

        if (payload.type === 'points') {
          if (!isCameraActive) {
            return;
          }

          setIsCameraReady(true);
          setDebugText(`?몄떇 以? ${payload.summary}`);
          return;
        }

        if (payload.type === 'dribble_analysis') {
          if (!isLessonActive) {
            return;
          }

          setIsCameraReady(true);
          applyDribbleAnalysis(payload.analysis);
          return;
        }

        if (payload.type === 'shoot_analysis') {
          if (!isLessonActive) {
            return;
          }

          setIsCameraReady(true);
          applyShootAnalysisWithStance(payload.analysis);
          return;
        }

        if (payload.type === 'shoot_success_circle_detected') {
          if (!isLessonActive || lessonModeRef.current !== 'shoot') {
            return;
          }

          if (shootSuccessRecordedForCurrentAttemptRef.current || !hasCompletedShootAttempt()) {
            return;
          }

          recordSuccessfulShot({
            preserveFeedback: true,
            debugMessage: '슛 성공 제스처를 확인했습니다.',
            celebrate: true,
          });
          return;
        }

        if (payload.type === 'recording_ready') {
          if (pendingReviewStopRef.current) {
            void completeDribbleReview(payload.videoUri);
            return;
          }

          if (pendingShootReviewRef.current || pendingShootRecordingStopRef.current) {
            void completeShootReview(payload.videoUri);
            return;
          }

          void finalizeLessonSession(
            pendingStopSaveRef.current,
            payload.videoUri,
            pendingStopSaveRef.current && cameraStopMode === 'review'
          );
          return;
        }

        if (payload.type === 'recording_error') {
          setDebugText(payload.message || '?곸긽 ??μ뿉 ?ㅽ뙣?덉뒿?덈떎. ?쇰뱶諛깅쭔 ?좎????곹깭濡?醫낅즺?⑸땲??');

          if (pendingReviewStopRef.current) {
            resumeDribbleLessonCycle(
              '녹화 저장에는 문제가 있었지만 목표 드리블 횟수는 채웠습니다. 다시 준비 자세를 잡으면 같은 횟수로 다음 레슨을 바로 시작합니다.'
            );
            return;
          }

          if (pendingShootReviewRef.current || pendingShootRecordingStopRef.current) {
            pendingShootReviewRef.current = false;
            pendingShootRecordingStopRef.current = false;
            const finalFeedback = buildShootReviewFeedback(latestShootAnalysisRef.current);
            latestFeedbackRef.current = `${finalFeedback}\n\n?곸긽 ??μ뿉???ㅽ뙣?덉뒿?덈떎.`;
            setFeedbackText(latestFeedbackRef.current);
            resetShootAnalysisTracking();
            setRecordingStartToken(0);
            setRecordingStopToken(0);
            setShootResetToken(0);
            setCameraStopMode(null);
            setIsCameraPreviewHidden(false);
            dribbleLessonPhaseRef.current = 'stance_setup';
            shootLessonStartedRef.current = false;
            setIsLessonActive(true);
            setIsCameraActive(true);
            setIsCameraReady(true);
            setIsShootSuccessButtonVisible(false);
            setImmediateLessonFeedback(`${latestFeedbackRef.current}\n\n?ㅼ떆 ??以鍮??먯꽭瑜?留욎떠 二쇱꽭??`);
            return;
          }

          if (pendingStopSaveRef.current) {
            void finalizeLessonSession(
              true,
              '',
              cameraStopMode === 'review'
            );
          }
          return;
        }

        if (payload.type === 'error') {
          setCameraError(payload.message || 'MediaPipe ?먮뒗 移대찓???쒖옉 以?臾몄젣媛 諛쒖깮?덉뒿?덈떎.');
          setDebugText(payload.message || '移대찓???쒖옉 ?ㅽ뙣');
        }
      } catch {
        setDebugText('移대찓???곹깭 硫붿떆吏瑜?泥섎━?섎뒗 以?臾몄젣媛 諛쒖깮?덉뒿?덈떎.');
      }
    },
    [
      applyDribbleAnalysis,
      applyShootAnalysisWithStance,
      clearRecordingWait,
      completeDribbleReview,
      completeShootReview,
      cameraStopMode,
      finalizeLessonSession,
      hasCompletedShootAttempt,
      isCameraActive,
      isLessonActive,
      playStartCue,
      recordSuccessfulShot,
      resetShootAnalysisTracking,
      setImmediateLessonFeedback,
    ]
  );

  function openDiaryDate(dateKey: string) {
    setSelectedDateKey(dateKey);
    setCurrentDate(parseDateKeyToDate(dateKey));
  }

  function changeMonth(delta: number) {
    setCurrentDate((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));
  }

  function registerSuccessfulShot() {
    if (lessonMode !== 'shoot') {
      Alert.alert('??遺꾩꽍 紐⑤뱶 ?꾩슜', '???깃났 湲곕줉? ??遺꾩꽍 紐⑤뱶?먯꽌留??ъ슜?????덉뒿?덈떎.');
      return;
    }

    if (!isShootSuccessButtonVisible) {
      Alert.alert('??諛쒖궗 ?뺤씤 ?꾩슂', '??諛쒖궗瑜?癒쇱? ?몄떇???ㅼ뿉 ???깃났??湲곕줉?????덉뒿?덈떎.');
      return;
    }

    recordSuccessfulShot();
  }

  function toggleLessonRecordShotOutcome(recordId: string) {
    const record = lessonRecordsRef.current.find((item) => item.id === recordId);

    if (!record || record.mode !== 'shoot') {
      return;
    }

    const nextShotOutcome = record.shotOutcome === 'success' ? 'failure' : 'success';
    const delta = nextShotOutcome === 'success' ? 1 : -1;
    const nextLessonRecords = lessonRecordsRef.current.map((item) =>
      item.id === recordId
        ? normalizeLessonRecord({
            ...item,
            shotOutcome: nextShotOutcome,
            evaluation: updateShootRecordEvaluationForOutcome(item, nextShotOutcome),
          })
        : item
    );

    lessonRecordsRef.current = nextLessonRecords;
    setLessonRecords(nextLessonRecords);
    persistLessonRecords(nextLessonRecords);
    updateShotSuccessCount(record.dateKey, delta);
  }

  async function openSkillVideo() {
    if (!selectedSkill || !selectedSkillKey) {
      return;
    }

    const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(selectedSkill.query)}`;
    const supported = await Linking.canOpenURL(url);

    if (!supported) {
      Alert.alert('?닿린 ?ㅽ뙣', '湲곌린?먯꽌 ?곸긽???????놁뒿?덈떎.');
      return;
    }

    await Linking.openURL(url);
    recordSkillVideoOpen(selectedSkillKey);
  }

  async function deleteLessonRecord(recordId: string) {
    const record = lessonRecordsRef.current.find((item) => item.id === recordId);

    if (record?.videoUri && !record.videoUri.startsWith('data:')) {
      try {
        await FileSystem.deleteAsync(record.videoUri, { idempotent: true });
      } catch {
        // Ignore delete failures for already-removed files.
      }
    }

    if (record?.thumbnailUri && !record.thumbnailUri.startsWith('data:')) {
      try {
        await FileSystem.deleteAsync(record.thumbnailUri, { idempotent: true });
      } catch {
        // Ignore delete failures for already-removed files.
      }
    }

    if (record?.mode === 'shoot') {
      updateShotAttemptCount(record.dateKey, -1);

      if (record.shotOutcome === 'success') {
        updateShotSuccessCount(record.dateKey, -1);
      }
    }

    const nextLessonRecords = lessonRecordsRef.current.filter((item) => item.id !== recordId);
    lessonRecordsRef.current = nextLessonRecords;
    setLessonRecords(nextLessonRecords);
    persistLessonRecords(nextLessonRecords);
  }

  return {
    isReady,
    authMode,
    currentUser,
    screen,
    lessonMode,
    homeworkToShow,
    homeworkTestState,
    currentDate,
    selectedDateKey,
    selectedDateRecords,
    selectedDateDribbleCount,
    diarySkillInsight,
    shotGraphData,
    calendarCells,
    selectedSkillKey,
    selectedBallBrand,
    selectedBallColors,
    ballRecognitionProfile,
    ballRecognitionPreviews,
    ballRecognitionCalibrationJob,
    isBallRecognitionTraining,
    selectedPosition,
    selectedDribbleView,
    debugText,
    feedbackText,
    lessonReview,
    currentDribbleCount,
    isCameraActive,
    isCameraPreviewHidden,
    isLessonActive,
    isCameraReady,
    cameraSessionKey,
    countdownValue,
    startupStatusText,
    isShootSuccessButtonVisible,
    recoverStartupToLogin,
    dribbleResetToken,
    shootResetToken,
    recordingStartToken,
    recordingStopToken,
    cameraStopMode,
    cameraError,
    fireworks,
    showFireworks,
    changeAuthMode,
    createTransferCode,
    importAccountTransfer,
    login,
    signup,
    updateProfile,
    changePassword,
    logout,
    navigateTo,
    changeLessonMode,
    beginLesson,
    endLesson,
    handlePoseMessage,
    registerSuccessfulShot,
    toggleLessonRecordShotOutcome,
    selectSkill,
    selectBallBrand,
    toggleBallColor,
    startBallRecognitionTrainingFromCamera,
    startBallRecognitionTrainingFromLibrary,
    startBallRecognitionTrainingFromUrls,
    handleBallRecognitionCalibrationComplete,
    handleBallRecognitionCalibrationError,
    resetBallRecognitionTraining,
    selectPosition,
    setSelectedDribbleView,
    openSkillVideo,
    applyHomeworkTestState,
    openDiaryDate,
    changeMonth,
    deleteLessonRecord,
  };
}








