create table task (
      pk bigint not null auto_increment,
      batch_id varchar(255),
      check_different bit,
      check_missing bit,
      compare_fields varchar(255),
      completed integer,
      created_time datetime not null,
      destination_aet varchar(255),
      device_name varchar(255) not null,
      different integer not null,
      error_comment varchar(255),
      error_msg varchar(255),
      exporter_id varchar(255),
      failed integer,
      local_aet varchar(255),
      matches integer not null,
      missing integer not null,
      modalities varchar(255),
      num_failures integer not null,
      num_instances integer,
      outcome_msg varchar(255),
      payload longblob,
      proc_end_time datetime,
      proc_start_time datetime,
      query_str varchar(255),
      queue_name varchar(255) not null,
      remaining integer,
      remote_aet varchar(255),
      rq_uri varchar(4000),
      rq_host varchar(255),
      rq_user_id varchar(255),
      scheduled_time datetime not null,
      series_iuid varchar(255),
      sop_iuid varchar(255),
      task_status integer not null,
      status_code integer,
      storage_ids varchar(255),
      stgcmt_policy integer,
      study_iuid varchar(255),
      task_type integer not null,
      update_location_status bit,
      updated_time datetime not null,
      version bigint,
      warning integer not null,
      primary key (pk)
);

create table rel_task_dicomattrs (task_fk bigint not null, dicomattrs_fk bigint not null);

alter table rel_task_dicomattrs add constraint UK_e0gtunmen48q8imxggunt7gt7  unique (dicomattrs_fk);
alter table rel_task_dicomattrs add constraint FK_e0gtunmen48q8imxggunt7gt7 foreign key (dicomattrs_fk) references dicomattrs (pk);
alter table rel_task_dicomattrs add constraint FK_pwaoih2f4ay4c00avvt79de7h foreign key (task_fk) references task (pk);

alter table stgcmt_result add task_fk bigint;

create index UK_j292rvji1d7hintidhgkkcbpw on stgcmt_result (task_fk);
create index UK_m47ruxpag7pq4gtn12lc63yfe on task (device_name(64));
create index UK_r2bcfyreh4n9h392iik1aa6sh on task (queue_name(64));
create index UK_a582by7kuyuhk8hi41tkelhrw on task (task_type);
create index UK_7y5ucdiygunyg2nh7qrs70e7k on task (task_status);
create index UK_76hkd9mjludoohse4g0ru1mg8 on task (created_time);
create index UK_9htwq4ofarp6m88r3ao0grt8j on task (updated_time);
create index UK_xwqht1afwe7k27iulvggnwwl on task (scheduled_time);
create index UK_k6dxmm1gu6u23xq03hbk80m4r on task (batch_id(64));
create index UK_17gcm1xo6fkujauguyjfxfb2k on task (local_aet(64));
create index UK_81xi6wnv5b10x3723fxt5bmew on task (remote_aet(64));
create index UK_f7c43c242ybnvcn3o50lrcpkh on task (destination_aet(64));
create index UK_pknlk8ggf8lnq38lq3gacvvpt on task (check_missing);
create index UK_1lchdfbbwkjbg7a6coy5t8iq7 on task (check_different);
create index UK_ow0nufrtniev7nkh7d0uv5mxe on task (compare_fields(64));
create index UK_6a0y0rsssms4mtm9bpkw8vgl6 on task (study_iuid(64), series_iuid(64), sop_iuid(64));

create index FK_pwaoih2f4ay4c00avvt79de7h on rel_task_dicomattrs (task_fk) ;

-- part 2: shall be applied on stopped archive before starting 5.24

-- part 3: can be applied on already running archive 5.24
alter table stgcmt_result drop msg_id;

drop table diff_task_attrs;
drop table diff_task;
drop table export_task;
drop table retrieve_task;
drop table stgver_task;
drop table queue_msg;

drop sequence diff_task_pk_seq;
drop sequence export_task_pk_seq;
drop sequence retrieve_task_pk_seq;
drop sequence stgver_task_pk_seq;
drop sequence queue_msg_pk_seq;