-- Existing uniforms remain unclassified until an administrator reviews them.
CREATE TYPE "UniformGender" AS ENUM ('MASCULINO', 'FEMININO');

ALTER TABLE "UniformVariant" ADD COLUMN "gender" "UniformGender";
