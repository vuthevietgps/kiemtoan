-- CreateTable
CREATE TABLE "payment_allocations" (
    "id" UUID NOT NULL,
    "payment_id" UUID NOT NULL,
    "installment_id" UUID NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "payment_allocations_installment_id_idx" ON "payment_allocations"("installment_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_allocations_payment_id_installment_id_key" ON "payment_allocations"("payment_id", "installment_id");

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_installment_id_fkey" FOREIGN KEY ("installment_id") REFERENCES "payment_installments"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- 07-B (J4, J15): phân bổ phiếu thu hiện có vào đợt, cùng quy tắc với `allocateContract` trong code:
-- duyệt phiếu theo (created_at, code); phiếu chỉ định đợt → vào đợt đó trước (tối đa phần còn trống);
-- phần dư và phiếu không chỉ định → lần lượt các đợt theo (due_date, sort_order, id) còn trống.
DO $$
DECLARE
  p RECORD;
  i RECORD;
  amt NUMERIC(18, 2);
  used NUMERIC(18, 2);
BEGIN
  CREATE TEMP TABLE _room ON COMMIT DROP AS
    SELECT id, contract_id, due_date, sort_order, amount AS room
    FROM payment_installments;
  FOR p IN
    SELECT id, contract_id, installment_id, amount
    FROM payments
    WHERE deleted_at IS NULL
    ORDER BY contract_id, created_at, code
  LOOP
    amt := p.amount;
    IF p.installment_id IS NOT NULL THEN
      SELECT LEAST(room, amt) INTO used FROM _room
        WHERE id = p.installment_id AND contract_id = p.contract_id;
      IF used IS NOT NULL AND used > 0 THEN
        INSERT INTO payment_allocations (id, payment_id, installment_id, amount)
          VALUES (gen_random_uuid(), p.id, p.installment_id, used);
        UPDATE _room SET room = room - used WHERE id = p.installment_id;
        amt := amt - used;
      END IF;
    END IF;
    FOR i IN
      SELECT id, room FROM _room
      WHERE contract_id = p.contract_id AND room > 0
      ORDER BY due_date, sort_order, id
    LOOP
      EXIT WHEN amt <= 0;
      used := LEAST(i.room, amt);
      INSERT INTO payment_allocations (id, payment_id, installment_id, amount)
        VALUES (gen_random_uuid(), p.id, i.id, used)
        ON CONFLICT (payment_id, installment_id)
        DO UPDATE SET amount = payment_allocations.amount + EXCLUDED.amount;
      UPDATE _room SET room = room - used WHERE id = i.id;
      amt := amt - used;
    END LOOP;
  END LOOP;
END $$;
