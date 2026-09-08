export type MotorFraudIndicator = {
  source: string;
  main: string;
  sub: string;
  classification: 'منخفض' | 'متوسط' | 'عالي';
};

export const MOTOR_FRAUD_INDICATORS: MotorFraudIndicator[] = [
  { source: 'أطراف الحادث', main: 'وقت وقوع الحادث', sub: 'الإبلاغ عن الحادث بعد شراء وثيقة التأمين خلال الأيام الأولى مع وجود انقطاع في التأمين ويقترن مع مؤشرات أخرى.', classification: 'منخفض' },
  { source: 'أطراف الحادث', main: 'وقت وقوع الحادث', sub: 'عدم الإبلاغ عن الحادث في الوقت النظامي مع عدم وجود مبررات مقنعة.', classification: 'متوسط' },
  { source: 'أطراف الحادث', main: 'وقت وقوع الحادث', sub: 'وجود مطالبة سابقة مرفوضة لنفس الأشخاص والمركبات والأضرار.', classification: 'عالي' },
  { source: 'أطراف الحادث', main: 'وقت وقوع الحادث', sub: 'الإبلاغ عن الحادث في أوقات متأخرة ليلاً في أماكن غير مأهولة أو محافظات صغيرة أو مناطق نائية ويقترن مع مؤشرات أخرى.', classification: 'متوسط' },
  { source: 'أطراف الحادث', main: 'قائد المركبة', sub: 'ادعاء أحد أطراف الحادث على طرف آخر بأنه قام باستبدال السائق من خلال الإفادة الكتابية.', classification: 'متوسط' },
  { source: 'أطراف الحادث', main: 'قائد المركبة', sub: 'وجود علاقة بين أطراف الحادث تثير الشبهة وتقترن بمؤشرات أخرى.', classification: 'متوسط' },
  { source: 'أطراف الحادث', main: 'قائد المركبة', sub: 'عدم تطابق الإفادة المقدمة من الأطراف بشكل جوهري أو تقديم عدة إفادات متناقضة لمعاين الحادث.', classification: 'متوسط' },
  { source: 'أطراف الحادث', main: 'كيفية وقوع الحادث', sub: 'تغيير وقائع الحادث الفعلية لجعل نسبة المسؤولية على طرف معطي تأمين.', classification: 'عالي' },
  { source: 'أطراف الحادث', main: 'كيفية وقوع الحادث', sub: 'ارتفاع معدل الحوادث لدى أحد الأطراف خلال السنة التأمينية ويقترن مع مؤشرات أخرى.', classification: 'عالي' },
  { source: 'أطراف الحادث', main: 'كيفية وقوع الحادث', sub: 'تكرار الحوادث بنفس الكيفية من أحد الأطراف.', classification: 'عالي' },
  { source: 'أطراف الحادث', main: 'كيفية وقوع الحادث', sub: 'ارتفاع معدل الحوادث على مركبة مؤمنة وتكرار الحوادث بنفس الكيفية خلال مدة زمنية قصيرة، بالرغم من انتقال ملكيتها لمالك آخرين.', classification: 'عالي' },
  { source: 'أطراف الحادث', main: 'كيفية وقوع الحادث', sub: 'وقوع الحادث على مركبة واحدة مؤمنة تأمين شامل بالرغم من أن المكان خال من المركبات أو منعزل، دون وجود أسباب منطقية تبرر الاصطدام بالجسم الثابت.', classification: 'عالي' },
  { source: 'المركبات', main: 'عدم تطابق', sub: 'عدم تطابق مستوى ارتفاع الأضرار بين المركبات.', classification: 'عالي' },
  { source: 'المركبات', main: 'عدم تطابق', sub: 'عدم تطابق انتقال الألوان بين المركبتين المتضررتين أو بين المركبة والجسم الثابت.', classification: 'عالي' },
  { source: 'المركبات', main: 'عدم تطابق', sub: 'عدم تطابق جسامة الأضرار على المركبة المتضررة مع الأضرار على المركبة المتسببة.', classification: 'عالي' },
  { source: 'المركبات', main: 'عدم تطابق', sub: 'اختلاف شكل الضرر كلياً من خلال وقوع الحادث وموقعه.', classification: 'عالي' },
  { source: 'المركبات', main: 'الأضرار قديمة', sub: 'وجود آثار تدل على أن الضرر في المركبة قديم مثل وجود أتربة.', classification: 'عالي' },
  { source: 'المركبات', main: 'الأضرار قديمة', sub: 'وجود آثار صدأ على الأجزاء المتضررة في المركبات.', classification: 'عالي' },
  { source: 'المركبات', main: 'التكاليف الباهظة', sub: 'في حال وجود تقديرات للمركبة بمبالغ عالية في حوادث التلفيات البسيطة مقترنة بمؤشرات أخرى.', classification: 'متوسط' },
  { source: 'موقع الحادث', main: 'الآثار في موقع الحادث', sub: 'عدم وجود آثار تلفيات على المركبات في موقع الحادث، على الرغم من جسامة الأضرار التي لحقت بها، مما يشير إلى إخفاء حقائق جوهرية من قبل أطراف الحادث.', classification: 'عالي' },
  { source: 'موقع الحادث', main: 'الآثار في موقع الحادث', sub: 'الآثار الموجودة في موقع الحادث لا تتناسب مع حجم التلفيات الناتجة عنه، ويشتبه في وضعها من قبل أطراف الحادث بهدف إيهام مباشر الحادث بصحة وقوعه.', classification: 'عالي' },
];

export const MOTOR_FRAUD_SOURCES = Array.from(new Set(MOTOR_FRAUD_INDICATORS.map((item) => item.source)));

export function motorFraudMainIndicators(source: string) {
  return Array.from(new Set(MOTOR_FRAUD_INDICATORS.filter((item) => item.source === source).map((item) => item.main)));
}

export function motorFraudSubIndicators(source: string, main: string) {
  return MOTOR_FRAUD_INDICATORS.filter((item) => item.source === source && item.main === main);
}

export function findMotorFraudIndicator(source: string, main: string, sub: string) {
  return MOTOR_FRAUD_INDICATORS.find((item) => item.source === source && item.main === main && item.sub === sub) || null;
}
