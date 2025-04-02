import pendulum
from airflow import DAG
from airflow.operators.bash import BashOperator

with DAG(
    dag_id="example",
    start_date=pendulum.datetime(2025, 4, 1),
    schedule=None
):
    op = BashOperator(task_id="hello_world", bash_command="echo 'Hello World!'")
    print(op.retries)