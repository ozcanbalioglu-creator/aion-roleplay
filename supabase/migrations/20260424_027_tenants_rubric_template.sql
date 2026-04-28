-- 027: tenants tablosuna rubric_template_id FK ekle
-- Super Admin, her tenant için hangi rubric template'inin kullanılacağını atar.
-- NULL ise evaluation engine is_default=true global template'e düşer.

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS rubric_template_id UUID
    REFERENCES public.rubric_templates(id) ON DELETE SET NULL;
