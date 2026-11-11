// Built-in exercise library. Custom exercises added in the app are stored separately.
export const MUSCLES = ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Quads', 'Hamstrings', 'Glutes', 'Calves', 'Core'];

const L = (muscle, equip, names) => names.map(name => ({ name, muscle, equip }));

export const LIBRARY = [
  ...L('Chest', 'Barbell', ['Bench Press', 'Incline Bench Press', 'Decline Bench Press']),
  ...L('Chest', 'Dumbbell', ['Dumbbell Bench Press', 'Incline Dumbbell Press', 'Dumbbell Fly']),
  ...L('Chest', 'Machine', ['Chest Press Machine', 'Pec Deck', 'Cable Fly']),
  ...L('Chest', 'Bodyweight', ['Push-Up', 'Chest Dip']),

  ...L('Back', 'Barbell', ['Barbell Row', 'Deadlift', 'T-Bar Row']),
  ...L('Back', 'Dumbbell', ['Dumbbell Row', 'Chest-Supported Dumbbell Row']),
  ...L('Back', 'Machine', ['Lat Pulldown', 'Seated Cable Row', 'Straight-Arm Pulldown', 'Machine Row', 'Assisted Pull-Up']),
  ...L('Back', 'Bodyweight', ['Pull-Up', 'Chin-Up', 'Back Extension']),

  ...L('Shoulders', 'Barbell', ['Overhead Press']),
  ...L('Shoulders', 'Dumbbell', ['Dumbbell Shoulder Press', 'Lateral Raise', 'Front Raise', 'Rear Delt Fly', 'Arnold Press']),
  ...L('Shoulders', 'Machine', ['Machine Shoulder Press', 'Cable Lateral Raise', 'Face Pull', 'Reverse Pec Deck']),

  ...L('Biceps', 'Barbell', ['Barbell Curl', 'EZ-Bar Curl']),
  ...L('Biceps', 'Dumbbell', ['Dumbbell Curl', 'Hammer Curl', 'Incline Dumbbell Curl']),
  ...L('Biceps', 'Machine', ['Cable Curl', 'Preacher Curl']),

  ...L('Triceps', 'Barbell', ['Close-Grip Bench Press', 'Skull Crusher']),
  ...L('Triceps', 'Dumbbell', ['Overhead Dumbbell Extension', 'Dumbbell Kickback']),
  ...L('Triceps', 'Machine', ['Triceps Pushdown', 'Overhead Cable Extension']),
  ...L('Triceps', 'Bodyweight', ['Triceps Dip']),

  ...L('Quads', 'Barbell', ['Back Squat', 'Front Squat']),
  ...L('Quads', 'Dumbbell', ['Goblet Squat', 'Bulgarian Split Squat', 'Walking Lunge', 'Reverse Lunge', 'Step-Up']),
  ...L('Quads', 'Machine', ['Leg Press', 'Hack Squat', 'Leg Extension', 'Smith Machine Squat']),

  ...L('Hamstrings', 'Barbell', ['Romanian Deadlift', 'Stiff-Leg Deadlift', 'Good Morning']),
  ...L('Hamstrings', 'Dumbbell', ['Dumbbell Romanian Deadlift', 'Single-Leg Romanian Deadlift']),
  ...L('Hamstrings', 'Machine', ['Seated Leg Curl', 'Lying Leg Curl']),

  ...L('Glutes', 'Barbell', ['Hip Thrust', 'Glute Bridge', 'Sumo Deadlift']),
  ...L('Glutes', 'Machine', ['Hip Thrust Machine', 'Cable Kickback', 'Hip Abduction Machine', 'Cable Pull-Through', 'Glute-Focused Back Extension']),
  ...L('Glutes', 'Dumbbell', ['Dumbbell Hip Thrust', 'Curtsy Lunge']),

  ...L('Calves', 'Machine', ['Standing Calf Raise', 'Seated Calf Raise', 'Leg Press Calf Raise']),

  ...L('Core', 'Bodyweight', ['Plank', 'Hanging Leg Raise', 'Crunch', 'Dead Bug', 'Russian Twist']),
  ...L('Core', 'Machine', ['Cable Crunch', 'Ab Wheel Rollout', 'Pallof Press'])
];
