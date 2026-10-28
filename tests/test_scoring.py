import unittest

from carreira.scoring import analyze, clean_requirements, requirements_from_text, select_entries


def entry(item_id="one", skills=None, description="", confirmed=True, kind="project"):
    return {"id": item_id, "title": "Projeto", "description": description, "skills": skills or [], "confirmed": confirmed, "type": kind}


class ScoringTests(unittest.TestCase):
    def test_weighted_score_and_blockers(self):
        result = analyze({"entries": [entry(skills=["Python"])]}, [
            {"label": "Python", "weight": 5}, {"label": "Docker", "weight": 2, "eliminatory": True}])
        self.assertEqual(result["score"], 71.4)
        self.assertEqual(result["blockers"], ["Docker"])

    def test_mentions_are_only_partial(self):
        self.assertEqual(analyze({"entries": [entry(description="Utilizei Python nesta API")]}, [{"label": "Python"}])["score"], 50)

    def test_repetition_does_not_inflate_score(self):
        a = analyze({"entries": [entry(description="Python ")]}, [{"label": "Python"}])
        b = analyze({"entries": [entry(description="Python "*200)]}, [{"label": "Python"}])
        self.assertEqual(a["score"], b["score"])

    def test_imported_unconfirmed_data_never_scores(self):
        self.assertEqual(analyze({"entries": [entry(skills=["Python"], confirmed=False)]}, [{"label": "Python"}])["score"], 0)

    def test_synonyms_deduplicate_requirements(self):
        requirements = clean_requirements([{"label": "JS", "weight": 2}, {"label": "JavaScript", "weight": 5}])
        self.assertEqual(len(requirements), 1)
        self.assertEqual(requirements[0]["weight"], 5)
        self.assertEqual(analyze({"entries": [entry(skills=["JavaScript"])]}, requirements)["score"], 100)

    def test_distinct_technologies_are_not_substrings(self):
        result = analyze({"entries": [entry(description="JavaScript GitHub CSS C++")]}, [{"label": "Java"}, {"label": "Git"}, {"label": "C"}])
        self.assertEqual(result["score"], 0)

    def test_or_does_not_require_both_skills(self):
        result = analyze({"entries": [entry(skills=["Java"])]}, [{"label": "Python ou Java"}])
        self.assertEqual(result["score"], 100)

    def test_quantified_requirement_is_not_inferred_from_language(self):
        result = analyze({"entries": [entry(skills=["Python"])]}, [{"label": "3 anos de Python"}])
        self.assertEqual(result["score"], 0)

    def test_no_requirements_has_no_artificial_score(self):
        self.assertIsNone(analyze({"entries": []}, [])["score"])

    def test_extraction_keeps_proficiency_and_experience_context(self):
        labels = [r["label"] for r in requirements_from_text("3 anos de Python\nInglês avançado\nDocker desejável")]
        self.assertIn("3 anos de Python", labels)
        self.assertIn("Inglês avançado", labels)

    def test_selection_prioritizes_marginal_coverage_and_keeps_education(self):
        profile = {"entries": [entry("a", ["Python"]), entry("b", ["Python"]), entry("c", ["Docker"]), entry("d", kind="education")]}
        ids = select_entries(profile, [{"label": "Python"}, {"label": "Docker"}], limit=2)
        self.assertEqual(set(ids), {"a", "c", "d"})

    def test_invalid_weight_rejected(self):
        for weight in (0, -1, 101, float("nan")):
            with self.assertRaises(ValueError):
                clean_requirements([{"label": "Python", "weight": weight}])
