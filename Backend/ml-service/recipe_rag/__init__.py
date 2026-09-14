"""Recipe RAG package."""


def __getattr__(name):
    if name == "RecipeRAG":
        from .rag_pipeline import RecipeRAG

        return RecipeRAG
    raise AttributeError(name)


__all__ = ["RecipeRAG"]
